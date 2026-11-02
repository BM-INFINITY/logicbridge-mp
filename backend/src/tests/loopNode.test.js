/**
 * LoopNode Unit Tests
 * Covers:
 *   - Node metadata (type, name, category, icon)
 *   - Configuration validation (operations, items, batchSize, maxIterations)
 *   - Array & collection extraction (arrays, JSON strings, CSV text, objects, range)
 *   - Batch partitioning
 *   - Iteration execution & variable context
 *   - Break & continue behavior
 *   - Error handling (stop_on_error vs continue_on_error)
 *   - Maximum iteration execution limits
 */

const assert = require('assert');
const LoopNode = require('../nodes/LoopNode');
const ExecutionContext = require('../utils/ExecutionContext');
const { NodeTypes, BranchTypes } = require('../constants');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting LoopNode Unit Tests...\n');

  const loopNode = new LoopNode();

  // ── Group 1: Node Metadata ──────────────────────────────────────────────────
  console.log('Test Group 1: Node Metadata');
  check(loopNode.type === NodeTypes.ACTION_LOOP, 'LoopNode: type matches NodeTypes.ACTION_LOOP');
  check(loopNode.name === 'Loop / Batch', 'LoopNode: name is Loop / Batch');
  check(loopNode.category === 'logic', 'LoopNode: category is logic');
  check(loopNode.icon === 'Repeat', 'LoopNode: icon is Repeat');

  // ── Group 2: Validation ─────────────────────────────────────────────────────
  console.log('\nTest Group 2: Validation');
  const validNode = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'loop_items', items: [1, 2, 3] },
  };
  check(loopNode.validate(validNode).valid === true, 'LoopNode: validates valid loop_items config');

  const invalidOp = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'infinite_loop', items: [1, 2, 3] },
  };
  const invalidOpRes = loopNode.validate(invalidOp);
  check(invalidOpRes.valid === false && invalidOpRes.error.includes('Invalid loop operation'), 'LoopNode: rejects invalid operation');

  const missingItems = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'loop_items' },
  };
  const missingItemsRes = loopNode.validate(missingItems);
  check(missingItemsRes.valid === false && missingItemsRes.error.includes('Input collection or array expression is required'), 'LoopNode: rejects missing items');

  const invalidBatch = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'loop_items', items: [1], batchSize: 0 },
  };
  check(loopNode.validate(invalidBatch).valid === false, 'LoopNode: rejects batchSize < 1');

  const validRange = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'loop_range', count: 5 },
  };
  check(loopNode.validate(validRange).valid === true, 'LoopNode: validates valid loop_range config');

  const missingRangeCount = {
    id: 'loop-1',
    type: NodeTypes.ACTION_LOOP,
    data: { operation: 'loop_range' },
  };
  check(loopNode.validate(missingRangeCount).valid === false, 'LoopNode: rejects loop_range missing count');

  // ── Group 3: Array & Collection Extraction ──────────────────────────────────
  console.log('\nTest Group 3: Collection Extraction & Formats');
  const ctx = new ExecutionContext();
  ctx.setResult('step_users', {
    status: 200,
    data: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  });

  // 1. Direct array
  const items1 = loopNode.extractItems({ items: ['a', 'b', 'c'] }, ctx);
  check(Array.isArray(items1) && items1.length === 3, 'extractItems: direct array');

  // 2. Variable resolution from context
  const items2 = loopNode.extractItems({ items: '{{ step_users.data }}' }, ctx);
  check(Array.isArray(items2) && items2.length === 2 && items2[0].name === 'Alice', 'extractItems: resolves array from context');

  // 3. JSON string array
  const items3 = loopNode.extractItems({ items: '["alpha", "beta", "gamma"]' }, ctx);
  check(Array.isArray(items3) && items3.length === 3 && items3[1] === 'beta', 'extractItems: parses JSON string array');

  // 4. CSV text
  const items4 = loopNode.extractItems({ items: 'sku,qty\nSKU-1,10\nSKU-2,20' }, ctx);
  check(Array.isArray(items4) && items4.length === 2 && items4[0].sku === 'SKU-1', 'extractItems: parses CSV text');

  // 5. Range generation
  const items5 = loopNode.extractItems({ operation: 'loop_range', count: 4, start: 1, step: 2 }, ctx);
  check(Array.isArray(items5) && items5.length === 4 && items5[0] === 1 && items5[1] === 3 && items5[3] === 7, 'extractItems: generates stepped range');

  // 6. Empty / null fallback
  const items6 = loopNode.extractItems({ items: '' }, ctx);
  check(Array.isArray(items6) && items6.length === 0, 'extractItems: empty string returns empty array');

  // ── Group 4: Batch Partitioning ─────────────────────────────────────────────
  console.log('\nTest Group 4: Batch Partitioning');
  const fullList = [1, 2, 3, 4, 5, 6, 7];
  const batches = loopNode.partitionBatches(fullList, 3);
  check(batches.length === 3, 'partitionBatches: 7 items with batchSize 3 yields 3 batches');
  check(batches[0].length === 3 && batches[0][2] === 3, 'partitionBatches: batch 0 has 3 items');
  check(batches[1].length === 3 && batches[1][2] === 6, 'partitionBatches: batch 1 has 3 items');
  check(batches[2].length === 1 && batches[2][0] === 7, 'partitionBatches: batch 2 has remaining 1 item');

  // ── Group 5: Execution & Context State ──────────────────────────────────────
  console.log('\nTest Group 5: Execution & Context State');

  // 1. Fast-path empty array execution
  const emptyExecRes = await loopNode.execute(
    { id: 'loop-empty', data: { items: [] } },
    ctx
  );
  check(emptyExecRes.ok === true, 'Empty loop: executes successfully');
  check(emptyExecRes.total === 0 && emptyExecRes.iterations === 0, 'Empty loop: reports 0 iterations');
  check(emptyExecRes.selectedBranch === BranchTypes.DONE, 'Empty loop: selects DONE branch');

  // 2. Sequential execution with body callback
  const recordedContexts = [];
  const testNode = {
    id: 'loop-exec',
    data: { items: ['apple', 'banana', 'cherry'], batchSize: 1 },
  };

  const execRes = await loopNode.execute(testNode, ctx, {
    executeBody: async (state) => {
      // Verify context variables exposed during iteration
      check(ctx.loopContext.item === state.item, `Iteration ${state.index}: context.loopContext matches state`);
      recordedContexts.push({ ...state });
      return { fruit: state.item, uppercase: state.item.toUpperCase() };
    },
  });

  check(execRes.ok === true, 'Loop execution: succeeds');
  check(execRes.total === 3, 'Loop execution: reports total 3');
  check(execRes.iterations === 3, 'Loop execution: reports 3 completed iterations');
  check(execRes.results.length === 3, 'Loop execution: aggregates 3 iteration results');
  check(execRes.results[1].uppercase === 'BANANA', 'Loop execution: aggregates output from iteration 1');
  check(recordedContexts[0].isFirst === true, 'Iteration 0 marked isFirst = true');
  check(recordedContexts[2].isLast === true, 'Iteration 2 marked isLast = true');
  check(ctx.loopContext === null, 'Context: loopContext cleared after loop finishes');

  // ── Group 6: Batch Execution ────────────────────────────────────────────────
  console.log('\nTest Group 6: Batch Processing');
  const batchTestNode = {
    id: 'loop-batch',
    data: { items: [10, 20, 30, 40, 50], batchSize: 2 },
  };

  const batchResults = [];
  const batchExecRes = await loopNode.execute(batchTestNode, ctx, {
    executeBody: async (state) => {
      batchResults.push(state.batch);
      return { batchSum: state.batch.reduce((a, b) => a + b, 0) };
    },
  });

  check(batchExecRes.ok === true, 'Batch execution: succeeds');
  check(batchExecRes.batchCount === 3, 'Batch execution: processed 3 batches');
  check(batchExecRes.results[0].batchSum === 30, 'Batch execution: batch 0 sum is 30');
  check(batchExecRes.results[1].batchSum === 70, 'Batch execution: batch 1 sum is 70');
  check(batchExecRes.results[2].batchSum === 50, 'Batch execution: batch 2 sum is 50');

  // ── Group 7: Break & Early Termination ──────────────────────────────────────
  console.log('\nTest Group 7: Break / Early Termination');
  const breakNode = {
    id: 'loop-break',
    data: { items: [1, 2, 3, 4, 5] },
  };

  const breakRes = await loopNode.execute(breakNode, ctx, {
    executeBody: async (state) => {
      if (state.item === 3) {
        return { item: state.item, break: true };
      }
      return { item: state.item };
    },
  });

  check(breakRes.brokenEarly === true, 'Break: breaks early upon break signal');
  check(breakRes.iterations === 3, 'Break: stopped after iteration 3');
  check(breakRes.results.length === 3, 'Break: contains only 3 results');

  // ── Group 8: Error Handling Strategies ──────────────────────────────────────
  console.log('\nTest Group 8: Error Handling Strategies');

  // 1. Stop on error (default)
  const stopOnErrorNode = {
    id: 'loop-stop-err',
    data: { items: ['ok1', 'fail', 'ok2'], onError: 'stop' },
  };

  let threwStopError = false;
  try {
    await loopNode.execute(stopOnErrorNode, ctx, {
      executeBody: async (state) => {
        if (state.item === 'fail') {
          throw new Error('Simulated failure');
        }
        return { item: state.item };
      },
    });
  } catch (err) {
    threwStopError = err.message.includes('Loop failed at iteration 1');
  }
  check(threwStopError, 'onError=stop: halts execution and throws error');

  // 2. Continue on error
  const continueOnErrorNode = {
    id: 'loop-cont-err',
    data: { items: ['ok1', 'fail', 'ok2'], onError: 'continue' },
  };

  const contRes = await loopNode.execute(continueOnErrorNode, ctx, {
    executeBody: async (state) => {
      if (state.item === 'fail') {
        throw new Error('Transient error');
      }
      return { item: state.item };
    },
  });

  check(contRes.ok === true, 'onError=continue: completes without throwing');
  check(contRes.iterations === 2, 'onError=continue: reports 2 successful iterations');
  check(contRes.errorCount === 1, 'onError=continue: tracks 1 error');
  check(contRes.results.length === 3, 'onError=continue: aggregates 3 total entries');
  check(contRes.results[1]._failed === true, 'onError=continue: iteration 1 marked as failed');

  // ── Group 9: Maximum Iteration Guard ────────────────────────────────────────
  console.log('\nTest Group 9: Maximum Iterations Guard');
  const giantList = new Array(600).fill('item');
  const guardNode = {
    id: 'loop-guard',
    data: { items: giantList, maxIterations: 50 },
  };

  let limitThrown = false;
  try {
    await loopNode.execute(guardNode, ctx);
  } catch (err) {
    limitThrown = err.message.includes('Loop iteration limit exceeded');
  }
  check(limitThrown, 'Guard: enforces maxIterations limit');

  console.log(`\nLoopNode Unit Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled failure:', err);
  process.exit(1);
});


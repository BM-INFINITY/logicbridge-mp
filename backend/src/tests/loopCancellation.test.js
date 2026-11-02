/**
 * Loop Cancellation & Context Restoration Tests
 */

const LoopNode = require('../nodes/LoopNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runLoopCancellationTests() {
  console.log('\n🧪 Starting Loop Cancellation & Context Restoration Tests...\n');

  const loopNode = new LoopNode();

  // ── Group 1: Loop Break / Early Cancellation ──────────────────────────────
  console.log('Group 1: Loop Break / Early Cancellation');
  try {
    const context = new ExecutionContext();
    const executedItems = [];

    const result = await loopNode.execute(
      {
        id: 'loop_cancel_1',
        data: {
          operation: 'loop_items',
          items: ['item_1', 'item_2', 'item_break', 'item_4', 'item_5'],
        },
      },
      context,
      {
        executeBody: async (iterationState) => {
          executedItems.push(iterationState.item);
          if (iterationState.item === 'item_break') {
            return { processed: true, break: true };
          }
          return { processed: true };
        },
      }
    );

    assert(result.completed === true, 'Loop reports completed: true');
    assert(result.brokenEarly === true, 'Loop output flags brokenEarly: true');
    assert(result.iterations === 3, 'Terminated immediately after 3rd item (item_break)');
    assert(executedItems.length === 3, 'Executed items count matches 3');
    assert(executedItems[2] === 'item_break', 'Last executed item was item_break');
    assert(result.results.length === 3, 'Results array has 3 entries');
    assert(context.loopStack.length === 0, 'Context loopStack is empty after loop break');
    assert(context.currentLoop === null, 'Context currentLoop is null after loop break');
  } catch (err) {
    console.error('Unexpected error in Group 1:', err);
    failedTests++;
  }

  // ── Group 2: Error Cleanup & Single-Loop Context Restoration ──────────────
  console.log('\nGroup 2: Error Cleanup & Context Restoration');
  try {
    const context = new ExecutionContext();
    let threw = false;

    try {
      await loopNode.execute(
        {
          id: 'loop_fail_1',
          data: {
            operation: 'loop_items',
            items: [10, 20, 0, 40],
            onError: 'stop',
          },
        },
        context,
        {
          executeBody: async (iterationState) => {
            if (iterationState.item === 0) {
              throw new Error('Division by zero error');
            }
            return { result: 100 / iterationState.item };
          },
        }
      );
    } catch (e) {
      threw = e.message.includes('Division by zero');
    }

    assert(threw, 'Throws when item execution fails with onError: stop');
    assert(context.loopStack.length === 0, 'Loop stack is empty after loop throws error');
    assert(context.currentLoop === null, 'Current loop context is cleared after error');
  } catch (err) {
    console.error('Unexpected error in Group 2:', err);
    failedTests++;
  }

  // ── Group 3: Nested Loop Error & Parent Context Restoration ───────────────
  console.log('\nGroup 3: Nested Loop Error & Parent Context Restoration');
  try {
    const context = new ExecutionContext();
    const parentIterationState = {
      item: 'parent_row_1',
      index: 0,
      total: 3,
      isFirst: true,
      isLast: false,
      loopNodeId: 'parent_loop_node',
    };

    // Simulate outer loop actively iterating
    context.pushLoopContext(parentIterationState);
    assert(context.loopStack.length === 1, 'Initial parent loop context on stack');
    assert(context.currentLoop.loopNodeId === 'parent_loop_node', 'Current loop is parent');

    // Inner loop starts and fails
    let innerThrew = false;
    try {
      await loopNode.execute(
        {
          id: 'inner_loop_node',
          data: {
            operation: 'loop_items',
            items: ['child_a', 'child_error', 'child_c'],
            onError: 'stop',
          },
        },
        context,
        {
          executeBody: async (iterationState) => {
            if (iterationState.item === 'child_error') {
              throw new Error('Simulated inner child error');
            }
            return { childProcessed: iterationState.item };
          },
        }
      );
    } catch (e) {
      innerThrew = e.message.includes('Simulated inner child error');
    }

    assert(innerThrew, 'Inner loop threw expected error');
    // Critical verification: parent loop context must NOT be popped!
    assert(context.loopStack.length === 1, 'Parent loop context is preserved on the stack');
    assert(context.currentLoop !== null, 'Current loop is not null');
    assert(context.currentLoop.loopNodeId === 'parent_loop_node', 'Parent loop context correctly restored');
    assert(context.currentLoop.item === 'parent_row_1', 'Parent item correctly restored');

    // When outer loop finishes, it pops cleanly
    context.popLoopContext();
    assert(context.loopStack.length === 0, 'Loop stack empty after outer loop completion');
    assert(context.currentLoop === null, 'Current loop null after all loops complete');
  } catch (err) {
    console.error('Unexpected error in Group 3:', err);
    failedTests++;
  }

  // ── Group 4: Continue On Error Resilience ─────────────────────────────────
  console.log('\nGroup 4: Continue On Error Resilience');
  try {
    const context = new ExecutionContext();

    const result = await loopNode.execute(
      {
        id: 'loop_resilient_1',
        data: {
          operation: 'loop_items',
          items: ['ok_1', 'fail_2', 'ok_3', 'fail_4', 'ok_5'],
          onError: 'continue',
        },
      },
      context,
      {
        executeBody: async (iterationState) => {
          if (iterationState.item.startsWith('fail_')) {
            throw new Error(`Fault on ${iterationState.item}`);
          }
          return { item: iterationState.item, success: true };
        },
      }
    );

    assert(result.ok === true, 'Loop returns ok: true when continue on error is set');
    assert(result.completed === true, 'Loop finishes all iterations');
    assert(result.iterations === 3, 'Recorded 3 successful iterations');
    assert(result.errorCount === 2, 'Recorded 2 failed iterations in errorCount');
    assert(result.results.length === 5, 'Results array has entries for all 5 items');
    assert(result.results[1]._failed === true, 'Item 2 result flagged as failed');
    assert(result.results[2].success === true, 'Item 3 executed successfully');
    assert(context.loopStack.length === 0, 'Context stack cleared after loop completes');
  } catch (err) {
    console.error('Unexpected error in Group 4:', err);
    failedTests++;
  }

  console.log(`\nLoop Cancellation & Context Tests: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runLoopCancellationTests();


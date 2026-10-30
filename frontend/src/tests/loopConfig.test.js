/**
 * Frontend Loop & Batch Processing Node Configuration & Validation Unit Tests
 * Covers:
 *   - action-loop validation rules in NodeValidator
 *   - DefaultNodeData defaults for action-loop
 *   - Icon mapping and resolution (Repeat)
 *   - Palette definitions in NODE_DEFS
 *   - ReactFlowAdapter connection styling for 'loop' and 'done' branches
 *   - ReplayService branch and event construction for loops
 */

import NodeValidator from '../validators/NodeValidator.js';
import { NodeTypes } from '../constants/NodeTypes.js';
import DefaultNodeData from '../constants/DefaultNodeData.js';
import { getNodeIcon } from '../constants/Icons.js';
import { NODE_DEFS } from '../data/templates.js';
import ReactFlowAdapter from '../adapters/ReactFlowAdapter.js';
import { BranchColors } from '../constants/BranchColors.js';
import { ReplayService } from '../services/ReplayService.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function main() {
  console.log('\n🧪 Starting Frontend Loop & Batch Configuration Unit Tests...\n');

  // ── Group 1: Loop Node Validation ──────────────────────────────────────────
  console.log('Group 1: Loop Node Validation (action-loop)');

  // 1. Valid loop_items
  const validLoopItems = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_items',
      items: '{{ steps.http_step.data }}',
      batchSize: 1,
      maxIterations: 500,
    },
  };
  assert(NodeValidator.validateNode(validLoopItems).valid === true, 'Loop: validates valid loop_items');

  // 2. Valid loop_batch
  const validLoopBatch = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_batch',
      items: '{{ steps.http_step.data }}',
      batchSize: 5,
    },
  };
  assert(NodeValidator.validateNode(validLoopBatch).valid === true, 'Loop: validates valid loop_batch');

  // 3. Valid loop_range
  const validLoopRange = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_range',
      count: 10,
    },
  };
  assert(NodeValidator.validateNode(validLoopRange).valid === true, 'Loop: validates valid loop_range');

  // 4. Missing items for loop_items
  const missingItemsNode = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_items',
      items: '',
    },
  };
  const missingItemsRes = NodeValidator.validateNode(missingItemsNode);
  assert(
    missingItemsRes.valid === false && missingItemsRes.error.includes('Input collection or array expression is required'),
    'Loop: rejects loop_items missing items'
  );

  // 5. Missing count for loop_range
  const missingCountNode = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_range',
    },
  };
  const missingCountRes = NodeValidator.validateNode(missingCountNode);
  assert(
    missingCountRes.valid === false && missingCountRes.error.includes('Count or range limit is required'),
    'Loop: rejects loop_range missing count'
  );

  // 6. Invalid batch size
  const invalidBatchNode = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_items',
      items: '[1, 2, 3]',
      batchSize: 0,
    },
  };
  const invalidBatchRes = NodeValidator.validateNode(invalidBatchNode);
  assert(
    invalidBatchRes.valid === false && invalidBatchRes.error.includes('Batch size must be a positive integer'),
    'Loop: rejects batchSize < 1'
  );

  // 7. Invalid max iterations
  const invalidMaxIterNode = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'loop_items',
      items: '[1, 2, 3]',
      maxIterations: -5,
    },
  };
  const invalidMaxIterRes = NodeValidator.validateNode(invalidMaxIterNode);
  assert(
    invalidMaxIterRes.valid === false && invalidMaxIterRes.error.includes('Maximum iterations must be a positive integer'),
    'Loop: rejects maxIterations < 1'
  );

  // 8. Invalid operation
  const invalidOpNode = {
    type: NodeTypes.ACTION_LOOP,
    data: {
      operation: 'invalid_op',
    },
  };
  const invalidOpRes = NodeValidator.validateNode(invalidOpNode);
  assert(
    invalidOpRes.valid === false && invalidOpRes.error.includes('Invalid operation "invalid_op"'),
    'Loop: rejects invalid loop operation'
  );

  // ── Group 2: DefaultNodeData Defaults ──────────────────────────────────────
  console.log('\nGroup 2: DefaultNodeData Defaults');

  const loopDefaults = DefaultNodeData[NodeTypes.ACTION_LOOP];
  assert(Boolean(loopDefaults), 'DefaultNodeData defines ACTION_LOOP');
  assert(loopDefaults.label === 'Loop / Batch', 'Loop default label is "Loop / Batch"');
  assert(loopDefaults.operation === 'loop_items', 'Loop default operation is "loop_items"');
  assert(loopDefaults.batchSize === 1, 'Loop default batchSize is 1');
  assert(loopDefaults.maxIterations === 500, 'Loop default maxIterations is 500');
  assert(loopDefaults.onError === 'stop', 'Loop default onError is "stop"');

  // ── Group 3: Icon Mapping ──────────────────────────────────────────────────
  console.log('\nGroup 3: Icon Mapping');

  const loopIcon = getNodeIcon(NodeTypes.ACTION_LOOP);
  assert(Boolean(loopIcon), 'getNodeIcon returns icon for action-loop');

  // ── Group 4: Palette Definitions in NODE_DEFS ──────────────────────────────
  console.log('\nGroup 4: Palette Definitions in NODE_DEFS');

  const loopDef = NODE_DEFS[NodeTypes.ACTION_LOOP];
  assert(Boolean(loopDef), 'NODE_DEFS contains action-loop');
  assert(loopDef.label === 'Loop / Batch', 'action-loop palette label is Loop / Batch');
  assert(loopDef.category === 'action', 'action-loop palette category is action');
  assert(loopDef.icon === 'Repeat', 'action-loop palette icon is Repeat');

  // ── Group 5: ReactFlowAdapter Edge Connection Styling ──────────────────────
  console.log('\nGroup 5: ReactFlowAdapter Edge Connection Styling');

  // 1. Loop handle connection
  const loopEdgeParams = { source: 'loop-1', target: 'transform-1', sourceHandle: 'loop' };
  const edgesWithLoop = ReactFlowAdapter.connectEdges(loopEdgeParams, []);
  assert(edgesWithLoop.length === 1, 'connectEdges: creates edge for loop handle');
  assert(edgesWithLoop[0].branch === 'loop', 'connectEdges: branch set to "loop"');
  assert(edgesWithLoop[0].label === 'Loop', 'connectEdges: edge labeled "Loop"');
  assert(edgesWithLoop[0].style.stroke === BranchColors.LOOP, 'connectEdges: edge styled with BranchColors.LOOP');

  // 2. Done handle connection
  const doneEdgeParams = { source: 'loop-1', target: 'slack-1', sourceHandle: 'done' };
  const edgesWithDone = ReactFlowAdapter.connectEdges(doneEdgeParams, []);
  assert(edgesWithDone.length === 1, 'connectEdges: creates edge for done handle');
  assert(edgesWithDone[0].branch === 'done', 'connectEdges: branch set to "done"');
  assert(edgesWithDone[0].label === 'Done', 'connectEdges: edge labeled "Done"');
  assert(edgesWithDone[0].style.stroke === BranchColors.DONE, 'connectEdges: edge styled with BranchColors.DONE');

  // ── Group 6: ReplayService Loop Event & Branch Tracking ────────────────────
  console.log('\nGroup 6: ReplayService Loop Tracking');

  const mockExecution = {
    _id: 'exec-replay-loop',
    status: 'success',
    startedAt: '2026-10-30T10:00:00.000Z',
    steps: [
      {
        nodeId: 'n1',
        nodeName: 'Start',
        nodeType: NodeTypes.TRIGGER_MANUAL,
        status: 'success',
      },
      {
        nodeId: 'n2',
        nodeName: 'User Loop',
        nodeType: NodeTypes.ACTION_LOOP,
        status: 'success',
        output: {
          total: 5,
          iterations: 5,
          selectedBranch: 'done',
        },
      },
      {
        nodeId: 'n3',
        nodeName: 'Slack Notice',
        nodeType: NodeTypes.ACTION_SLACK,
        status: 'success',
      },
    ],
  };

  const workflowNodes = [
    { id: 'n1', type: NodeTypes.TRIGGER_MANUAL },
    { id: 'n2', type: NodeTypes.ACTION_LOOP },
    { id: 'n3', type: NodeTypes.ACTION_SLACK },
  ];

  const snapshots = ReplayService.buildSnapshots(mockExecution, workflowNodes);
  assert(snapshots.length > 0, 'ReplayService: generated snapshots for loop workflow');

  const finalSnapshot = snapshots[snapshots.length - 1];
  assert(finalSnapshot.selectedBranches['n2'] === 'done', 'ReplayService: tracks loop selectedBranch as "done"');

  const loopEvent = finalSnapshot.events.find((e) => e.type === 'LOOP_COMPLETED');
  assert(Boolean(loopEvent), 'ReplayService: emits LOOP_COMPLETED event');
  assert(loopEvent.details.includes('5 of 5 iterations'), 'ReplayService: event details report 5 of 5 iterations');

  console.log(`\nFrontend Loop Configuration Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();


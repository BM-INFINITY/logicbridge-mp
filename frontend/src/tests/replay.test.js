/**
 * Visual Execution Timeline & Interactive Replay Unit Tests
 *
 * Tests ExecutionSnapshot immutability, ReplayService snapshot generation,
 * TimelineCursor seeking, filtering architecture, and ReplayCanvasAdapter transformations.
 */

import ExecutionSnapshot from '../models/ExecutionSnapshot.js';
import ReplayService from '../services/ReplayService.js';
import ReplayCanvasAdapter from '../adapters/ReplayCanvasAdapter.js';

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
  console.log('\n🧪 Starting Visual Replay & Timeline Unit Tests...\n');

  // ── Group 1: ExecutionSnapshot Immutability ──────────────────────────────
  console.log('Group 1: ExecutionSnapshot Immutability');

  const initialSnap = ExecutionSnapshot.initial([
    { id: 'node_1', type: 'trigger-manual' },
    { id: 'node_2', type: 'logic-condition' },
  ]);

  assert(initialSnap.stepIndex === -1, 'Initial snapshot has stepIndex -1');
  assert(initialSnap.nodeStatusMap.node_1 === 'pending', 'Initial snapshot node_1 status is pending');
  assert(Object.isFrozen(initialSnap), 'ExecutionSnapshot instance is frozen');
  assert(Object.isFrozen(initialSnap.nodeStatusMap), 'nodeStatusMap is frozen');
  assert(Object.isFrozen(initialSnap.selectedBranches), 'selectedBranches is frozen');
  assert(Object.isFrozen(initialSnap.events), 'events array is frozen');

  let mutationError = false;
  try {
    initialSnap.stepIndex = 99;
  } catch {
    mutationError = true;
  }
  assert(mutationError || initialSnap.stepIndex === -1, 'Snapshot properties cannot be mutated');

  // ── Group 2: Snapshot Generation from Execution Log ────────────────────────
  console.log('\nGroup 2: ReplayService.buildSnapshots()');

  const mockWorkflowNodes = [
    { id: 'trigger_1', type: 'trigger-manual', data: { label: 'Manual Trigger' } },
    { id: 'cond_1', type: 'logic-condition', data: { label: 'Check Threshold' } },
    { id: 'email_true', type: 'action-email', data: { label: 'Send True Email' } },
    { id: 'email_false', type: 'action-email', data: { label: 'Send False Email' } },
  ];

  const mockExecution = {
    _id: 'exec_101',
    status: 'success',
    trigger: 'manual',
    duration: 1500,
    startedAt: '2026-08-07T10:00:00.000Z',
    finishedAt: '2026-08-07T10:00:01.500Z',
    steps: [
      {
        nodeId: 'trigger_1',
        nodeName: 'Manual Trigger',
        nodeType: 'trigger-manual',
        status: 'success',
        duration: 100,
        input: { payload: 'test' },
        output: { trigger: 'ok' },
      },
      {
        nodeId: 'cond_1',
        nodeName: 'Check Threshold',
        nodeType: 'logic-condition',
        status: 'success',
        duration: 200,
        input: { value: 50 },
        output: { passed: true, selectedBranch: 'true' },
      },
      {
        nodeId: 'email_true',
        nodeName: 'Send True Email',
        nodeType: 'action-email',
        status: 'success',
        duration: 800,
        input: { to: 'user@example.com' },
        output: { delivered: true },
      },
      {
        nodeId: 'email_false',
        nodeName: 'Send False Email',
        nodeType: 'action-email',
        status: 'skipped',
        duration: 0,
        input: {},
        output: { skippedReason: 'Branch not selected' },
      },
    ],
  };

  const snapshots = ReplayService.buildSnapshots(mockExecution, mockWorkflowNodes);

  assert(Array.isArray(snapshots), 'buildSnapshots returns an array');
  assert(snapshots.length === 1 + (mockExecution.steps.length * 2) + 1, 'Generates initial + per-step frames + terminal summary frame');

  // Verify condition branch tracking
  const lastSnapshot = snapshots[snapshots.length - 1];
  assert(lastSnapshot.selectedBranches.cond_1 === 'true', 'Tracks condition selected branch "true"');
  assert(lastSnapshot.nodeStatusMap.email_true === 'success', 'email_true status is success');
  assert(lastSnapshot.nodeStatusMap.email_false === 'skipped', 'email_false status is skipped');

  // Verify event stream
  const eventTypes = lastSnapshot.events.map((e) => e.type);
  assert(eventTypes.includes('NODE_STARTED'), 'Event stream contains NODE_STARTED');
  assert(eventTypes.includes('CONDITION_EVALUATED'), 'Event stream contains CONDITION_EVALUATED');
  assert(eventTypes.includes('BRANCH_SELECTED'), 'Event stream contains BRANCH_SELECTED');
  assert(eventTypes.includes('NODE_SKIPPED'), 'Event stream contains NODE_SKIPPED');
  assert(eventTypes.includes('NODE_COMPLETED'), 'Event stream contains NODE_COMPLETED');
  assert(eventTypes.includes('EXECUTION_SUCCESS'), 'Event stream contains terminal EXECUTION_SUCCESS');

  // ── Group 3: TimelineCursor Navigation & Seeking ──────────────────────────
  console.log('\nGroup 3: TimelineCursor Navigation');

  const cursor0 = ReplayService.createCursor(0, snapshots);
  assert(cursor0.index === 0, 'Cursor 0 index is 0');
  assert(cursor0.isStart === true, 'Cursor 0 isStart is true');
  assert(cursor0.isEnd === false, 'Cursor 0 isEnd is false');

  const cursorEnd = ReplayService.createCursor(snapshots.length - 1, snapshots);
  assert(cursorEnd.isEnd === true, 'Last cursor isEnd is true');
  assert(cursorEnd.snapshotId === lastSnapshot.snapshotId, 'Cursor references correct snapshotId');

  // Seek clamping
  const clampedCursor = ReplayService.createCursor(999, snapshots);
  assert(clampedCursor.index === snapshots.length - 1, 'Cursor clamps out-of-bounds upper index');

  // ── Group 4: Filtering Architecture Readiness ─────────────────────────────
  console.log('\nGroup 4: Snapshot Filtering Architecture');

  const successOnly = ReplayService.filterSnapshots(snapshots, { status: 'success' });
  assert(successOnly.length > 0, 'status: success filter returns matching frames');

  const emailOnly = ReplayService.filterSnapshots(snapshots, { nodeType: 'action-email' });
  assert(emailOnly.length > 0, 'nodeType: action-email filter returns matching frames');

  const searchFiltered = ReplayService.filterSnapshots(snapshots, { search: 'Threshold' });
  assert(searchFiltered.length > 0, 'search filter matches node name');

  // ── Group 5: Statistics Calculation ──────────────────────────────────────
  console.log('\nGroup 5: Statistics Calculation');

  const stats = ReplayService.calculateStatistics(mockExecution, snapshots);
  assert(stats.totalDuration === 1500, 'Calculates correct total duration (1500ms)');
  assert(stats.executedCount === 3, 'Calculates correct executed nodes count (3)');
  assert(stats.skippedCount === 1, 'Calculates correct skipped nodes count (1)');
  assert(stats.failedCount === 0, 'Calculates correct failed nodes count (0)');
  assert(stats.successRate === 100, 'Calculates 100% success rate');
  assert(stats.triggerType === 'manual', 'Reports correct trigger type');
  assert(stats.selectedBranches.length === 1, 'Reports 1 selected branch');
  assert(stats.selectedBranches[0].selectedBranch === 'true', 'Selected branch is "true"');

  // ── Group 6: ReplayCanvasAdapter Transformation ──────────────────────────
  console.log('\nGroup 6: ReplayCanvasAdapter Transformations');

  const rawNodes = [...mockWorkflowNodes];
  const rawEdges = [
    { id: 'e1', source: 'trigger_1', target: 'cond_1' },
    { id: 'e2_true', source: 'cond_1', target: 'email_true', sourceHandle: 'true' },
    { id: 'e2_false', source: 'cond_1', target: 'email_false', sourceHandle: 'false' },
  ];

  // Test running snapshot transformation
  const runningSnap = snapshots.find((s) => s.status === 'running' && s.nodeId === 'cond_1');
  const transformedRunning = ReplayCanvasAdapter.applySnapshotToCanvas(rawNodes, rawEdges, runningSnap);

  const activeCondNode = transformedRunning.nodes.find((n) => n.id === 'cond_1');
  assert(activeCondNode.data._isActive === true, 'ReplayCanvasAdapter sets _isActive=true on running node');
  assert(activeCondNode.data._execStatus === 'running', 'ReplayCanvasAdapter sets _execStatus="running"');
  assert(transformedRunning.focusNodeId === 'cond_1', 'Returns correct focusNodeId');

  // Test final snapshot transformation
  const transformedFinal = ReplayCanvasAdapter.applySnapshotToCanvas(rawNodes, rawEdges, lastSnapshot);

  const trueEdge = transformedFinal.edges.find((e) => e.id === 'e2_true');
  const falseEdge = transformedFinal.edges.find((e) => e.id === 'e2_false');

  assert(trueEdge.animated === true, 'Selected "true" branch edge is animated');
  assert(trueEdge.style.stroke === '#22c55e', 'Selected "true" branch edge color is green (#22c55e)');
  assert(falseEdge.animated === false, 'Unselected "false" branch edge is NOT animated');
  assert(falseEdge.style.opacity < 0.5, 'Unselected "false" branch edge is dimmed (opacity < 0.5)');

  const skippedNode = transformedFinal.nodes.find((n) => n.id === 'email_false');
  assert(skippedNode.data._isSkipped === true, 'ReplayCanvasAdapter flags skipped node with _isSkipped=true');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME REPLAY TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL VISUAL REPLAY TESTS PASSED!\n');
  }
}

main();

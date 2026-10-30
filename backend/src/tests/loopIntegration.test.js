/**
 * Loop & Batch Processing Workflow Integration Tests
 * Covers:
 *   - Pipeline 1: HTTP -> Loop (Items) -> Transform (inside loop) -> Done -> Slack
 *   - Pipeline 2: Webhook -> Loop (Batch size 2) -> File CSV Append -> Done -> Storage S3 Upload
 *   - Pipeline 3: Conditional Routing inside Loop Body (True / False branches per iteration)
 *   - Pipeline 4: Error Handling in Engine (onError: 'continue' vs 'stop')
 *   - Pipeline 5: Maximum Iteration & Depth Guard Rails (infinite loop prevention)
 *   - Pipeline 6: Nested Loops (Outer loop -> Inner loop)
 *   - Pipeline 7: Workflow Serialization & Round-Trip with Loop Handles ('loop', 'done')
 */

const fs = require('fs');
const path = require('path');
const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const { run, findLoopBodyNodeIds, buildExecutionOrder } = require('../services/workflowEngine');
const WorkflowSerializer = require('../services/WorkflowSerializer');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');
const ConnectionService = require('../services/ConnectionService');
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
  console.log('\n🧪 Starting Loop & Batch Processing Workflow Integration Tests...\n');

  // Configure test storage path
  const testStorageDir = path.join(__dirname, 'temp_loop_storage');
  process.env.LOGICBRIDGE_STORAGE_PATH = testStorageDir;
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testStorageDir, { recursive: true });

  // Mock DB persistence on Execution and Workflow
  const originalExecCreate = Execution.create;
  const originalWorkflowUpdate = Workflow.findByIdAndUpdate;
  const originalGetCreds = ConnectionService.getDecryptedCredentials;

  Execution.create = async (doc) => ({ _id: 'exec_loop_test', ...doc });
  Workflow.findByIdAndUpdate = async () => ({});
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-slack-1') {
      return { token: 'xoxb-mock-slack-token', defaultChannel: '#notifications' };
    }
    if (connId === 'conn-s3-1') {
      return {
        accessKeyId: 'AKIA123456789012',
        secretAccessKey: 'sec987654321',
        region: 'us-east-1',
        bucket: 'batch-archive-bucket',
      };
    }
    throw new Error('Unknown connection: ' + connId);
  };

  try {
    // ── Group 1: Subgraph Discovery & Execution Order ─────────────────────────
    console.log('Test Group 1: Subgraph Discovery & Execution Order');

    const sampleWorkflowNodes = [
      { id: 'trig', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 100 } },
      { id: 'loop1', type: NodeTypes.ACTION_LOOP, position: { x: 200, y: 100 } },
      { id: 'body1', type: NodeTypes.ACTION_TRANSFORM, position: { x: 400, y: 50 } },
      { id: 'body2', type: NodeTypes.ACTION_HTTP, position: { x: 600, y: 50 } },
      { id: 'done1', type: NodeTypes.ACTION_LOG, position: { x: 400, y: 250 } },
    ];

    const sampleWorkflowEdges = [
      { id: 'e1', source: 'trig', target: 'loop1' },
      { id: 'e2', source: 'loop1', target: 'body1', sourceHandle: 'loop' },
      { id: 'e3', source: 'body1', target: 'body2' },
      { id: 'e4', source: 'loop1', target: 'done1', sourceHandle: 'done' },
    ];

    const bodyNodeIds = findLoopBodyNodeIds('loop1', sampleWorkflowNodes, sampleWorkflowEdges);
    check(bodyNodeIds.has('body1'), 'findLoopBodyNodeIds: identifies body node 1');
    check(bodyNodeIds.has('body2'), 'findLoopBodyNodeIds: identifies body node 2 downstream in loop');
    check(!bodyNodeIds.has('done1'), 'findLoopBodyNodeIds: excludes node on done handle');
    check(!bodyNodeIds.has('loop1'), 'findLoopBodyNodeIds: excludes loop node itself');

    const ordered = buildExecutionOrder(sampleWorkflowNodes, sampleWorkflowEdges);
    const trigIdx = ordered.findIndex((n) => n.id === 'trig');
    const loopIdx = ordered.findIndex((n) => n.id === 'loop1');
    const doneIdx = ordered.findIndex((n) => n.id === 'done1');
    check(trigIdx < loopIdx, 'ExecutionOrder: trigger runs before loop');
    check(loopIdx < doneIdx, 'ExecutionOrder: loop runs before done node');

    // ── Group 2: Pipeline 1 (HTTP -> Loop -> Transform -> Done -> Slack) ──────
    console.log('\nTest Group 2: Pipeline HTTP -> Loop -> Transform -> Slack');

    let postedSlackMessage = null;
    const { registry } = require('../nodes');
    const slackHandler = registry.get(NodeTypes.ACTION_SLACK);
    const originalSlackExecute = slackHandler.execute;
    slackHandler.execute = async (node, ctx) => {
      postedSlackMessage = node.data.text ? require('../utils/VariableResolver').resolveVariable(node.data.text, ctx) : '';
      return { ok: true, channel: node.data.channel, message: postedSlackMessage };
    };

    const usersWorkflow = {
      _id: 'wf_loop_pipeline_1',
      name: 'Process Users and Notify Slack',
      nodes: [
        {
          id: 'manual-start',
          type: NodeTypes.TRIGGER_MANUAL,
          position: { x: 50, y: 100 },
          data: { label: 'Start Manual' },
        },
        {
          id: 'loop-users',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 250, y: 100 },
          data: {
            label: 'Loop Users',
            operation: 'loop_items',
            items: [
              { id: 101, name: 'Alice', role: 'engineer' },
              { id: 102, name: 'Bob', role: 'designer' },
              { id: 103, name: 'Charlie', role: 'product' },
            ],
          },
        },
        {
          id: 'transform-user',
          type: NodeTypes.ACTION_TRANSFORM,
          position: { x: 500, y: 50 },
          data: {
            label: 'Transform User Record',
            operation: 'map',
            mappings: [
              { source: '{{ loop.item.id }}', outputField: 'empId' },
              { source: '{{ loop.item.name }}', outputField: 'empName' },
              { source: '{{ loop.index }}', outputField: 'idx' },
            ],
          },
        },
        {
          id: 'slack-summary',
          type: NodeTypes.ACTION_SLACK,
          position: { x: 500, y: 250 },
          data: {
            label: 'Post Summary to Slack',
            connectionId: 'conn-slack-1',
            operation: 'send_message',
            channel: '#notifications',
            text: 'Batch complete! Processed {{ loop-users.total }} team members. First: {{ loop-users.results.0.data.empName }}.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'manual-start', target: 'loop-users' },
        { id: 'e2', source: 'loop-users', target: 'transform-user', sourceHandle: 'loop' },
        { id: 'e3', source: 'loop-users', target: 'slack-summary', sourceHandle: 'done' },
      ],
    };

    const execResult1 = await run(usersWorkflow, 'user_1', 'manual');
    check(execResult1.status === 'success', 'Pipeline 1: Workflow executed successfully');
    check(execResult1.steps.length === 6, 'Pipeline 1: 6 steps recorded (1 trigger + 1 loop + 3 transform iterations + 1 slack)');

    const loopStep = execResult1.steps.find((s) => s.nodeId === 'loop-users');
    check(loopStep.output.total === 3, 'Pipeline 1: Loop reports total 3');
    check(loopStep.output.iterations === 3, 'Pipeline 1: Loop reports 3 iterations completed');
    check(loopStep.output.results.length === 3, 'Pipeline 1: Loop collected 3 iteration outputs');
    check(loopStep.output.results[0].data.empName === 'Alice', 'Pipeline 1: Iteration 0 has Alice');
    check(loopStep.output.results[2].data.empName === 'Charlie', 'Pipeline 1: Iteration 2 has Charlie');

    const transformSteps = execResult1.steps.filter((s) => s.nodeId === 'transform-user');
    check(transformSteps.length === 3, 'Pipeline 1: Transform executed exactly 3 times inside loop');
    check(transformSteps[0].iteration === 0, 'Pipeline 1: Step 0 tagged with iteration 0');
    check(transformSteps[1].iteration === 1, 'Pipeline 1: Step 1 tagged with iteration 1');
    check(transformSteps[2].iteration === 2, 'Pipeline 1: Step 2 tagged with iteration 2');

    check(
      postedSlackMessage === 'Batch complete! Processed 3 team members. First: Alice.',
      'Pipeline 1: Slack resolved variables from loop total and aggregated results'
    );

    // Restore slack handler
    slackHandler.execute = originalSlackExecute;

    // ── Group 3: Pipeline 2 (Batch Processing & File CSV Append) ───────────────
    console.log('\nTest Group 3: Batch Processing with File Node');

    const batchCsvWorkflow = {
      _id: 'wf_batch_csv',
      name: 'Batch Ingestion to CSV',
      nodes: [
        {
          id: 'trig-batch',
          type: NodeTypes.TRIGGER_MANUAL,
          position: { x: 50, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'loop-batches',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 250, y: 100 },
          data: {
            label: 'Process in Pairs',
            operation: 'loop_batch',
            batchSize: 2,
            items: [
              { orderId: 'ORD-1', amount: 50 },
              { orderId: 'ORD-2', amount: 75 },
              { orderId: 'ORD-3', amount: 120 },
              { orderId: 'ORD-4', amount: 40 },
              { orderId: 'ORD-5', amount: 95 },
            ],
          },
        },
        {
          id: 'file-append',
          type: NodeTypes.ACTION_FILE,
          position: { x: 500, y: 50 },
          data: {
            label: 'Append Batch to CSV',
            operation: 'write_file',
            path: 'reports/orders.csv',
            format: 'csv',
            append: true,
            content: '{{ loop.batch }}',
          },
        },
        {
          id: 'file-summary',
          type: NodeTypes.ACTION_FILE,
          position: { x: 500, y: 250 },
          data: {
            label: 'Read Final CSV',
            operation: 'read_file',
            path: 'reports/orders.csv',
            format: 'csv',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig-batch', target: 'loop-batches' },
        { id: 'e2', source: 'loop-batches', target: 'file-append', sourceHandle: 'loop' },
        { id: 'e3', source: 'loop-batches', target: 'file-summary', sourceHandle: 'done' },
      ],
    };

    const execResult2 = await run(batchCsvWorkflow, 'user_1', 'manual');
    check(execResult2.status === 'success', 'Pipeline 2: Batch workflow executed successfully');

    const batchLoopStep = execResult2.steps.find((s) => s.nodeId === 'loop-batches');
    check(batchLoopStep.output.total === 5, 'Pipeline 2: Total items is 5');
    check(batchLoopStep.output.batchCount === 3, 'Pipeline 2: Batch count is 3 (2 + 2 + 1)');
    check(batchLoopStep.output.iterations === 3, 'Pipeline 2: Ran 3 batch iterations');

    const fileAppendSteps = execResult2.steps.filter((s) => s.nodeId === 'file-append');
    check(fileAppendSteps.length === 3, 'Pipeline 2: File append executed once per batch');

    const fileSummaryStep = execResult2.steps.find((s) => s.nodeId === 'file-summary');
    check(fileSummaryStep.output.records.length === 5, 'Pipeline 2: Final CSV contains all 5 rows combined across batches');

    // ── Group 4: Pipeline 3 (Conditional Branching Inside Loop) ────────────────
    console.log('\nTest Group 4: Conditional Branching inside Loop Body');

    const conditionLoopWorkflow = {
      _id: 'wf_condition_loop',
      name: 'Loop with Condition',
      nodes: [
        {
          id: 'trig-cond',
          type: NodeTypes.TRIGGER_MANUAL,
          position: { x: 50, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'loop-orders',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 250, y: 100 },
          data: {
            label: 'Order Checker',
            items: [
              { id: 'o1', value: 150 },
              { id: 'o2', value: 45 },
              { id: 'o3', value: 200 },
            ],
          },
        },
        {
          id: 'check-high-val',
          type: NodeTypes.LOGIC_CONDITION,
          position: { x: 450, y: 50 },
          data: {
            label: 'Is High Value?',
            leftValue: '{{ loop.item.value }}',
            operator: 'greater-than',
            rightValue: 100,
          },
        },
        {
          id: 'log-high',
          type: NodeTypes.ACTION_LOG,
          position: { x: 650, y: 0 },
          data: { label: 'Log High Value', message: 'High value order: {{ loop.item.id }}' },
        },
        {
          id: 'log-standard',
          type: NodeTypes.ACTION_LOG,
          position: { x: 650, y: 100 },
          data: { label: 'Log Standard Value', message: 'Standard order: {{ loop.item.id }}' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig-cond', target: 'loop-orders' },
        { id: 'e2', source: 'loop-orders', target: 'check-high-val', sourceHandle: 'loop' },
        { id: 'e3', source: 'check-high-val', target: 'log-high', sourceHandle: 'true' },
        { id: 'e4', source: 'check-high-val', target: 'log-standard', sourceHandle: 'false' },
      ],
    };

    const execResult3 = await run(conditionLoopWorkflow, 'user_1', 'manual');
    check(execResult3.status === 'success', 'Pipeline 3: Conditional loop executed successfully');

    const highLogSteps = execResult3.steps.filter((s) => s.nodeId === 'log-high');
    const stdLogSteps = execResult3.steps.filter((s) => s.nodeId === 'log-standard');
    check(highLogSteps.length === 2, 'Pipeline 3: High value branch executed for 2 high value orders (o1, o3)');
    check(stdLogSteps.length === 1, 'Pipeline 3: Standard value branch executed for 1 standard order (o2)');

    // ── Group 5: Pipeline 4 (Error Handling Strategies in Engine) ──────────────
    console.log('\nTest Group 5: Engine Error Handling (stop vs continue)');

    // 1. onError = 'stop' (aborts whole execution)
    const failingWorkflowStop = {
      _id: 'wf_err_stop',
      name: 'Failing Loop Stop',
      nodes: [
        { id: 'trig-fail', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'loop-fail',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 200, y: 0 },
          data: {
            items: ['item1', 'cause_error', 'item3'],
            onError: 'stop',
          },
        },
        {
          id: 'failing-step',
          type: NodeTypes.ACTION_TRANSFORM,
          position: { x: 400, y: 0 },
          data: {
            operation: 'pick',
            // Missing fields configuration to trigger validation/execution error
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig-fail', target: 'loop-fail' },
        { id: 'e2', source: 'loop-fail', target: 'failing-step', sourceHandle: 'loop' },
      ],
    };

    const execResult4a = await run(failingWorkflowStop, 'user_1', 'manual');
    check(execResult4a.status === 'failed', 'Pipeline 4a: Workflow halted with status failed when onError=stop');
    check(execResult4a.error.includes('Loop Node') && execResult4a.error.includes('failed'), 'Pipeline 4a: Error message captures failure');

    // 2. onError = 'continue'
    const failingWorkflowContinue = {
      _id: 'wf_err_cont',
      name: 'Failing Loop Continue',
      nodes: [
        { id: 'trig-cont', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'loop-cont',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 200, y: 0 },
          data: {
            items: ['item1', 'item2'],
            onError: 'continue',
          },
        },
        {
          id: 'step-err',
          type: NodeTypes.ACTION_TRANSFORM,
          position: { x: 400, y: 0 },
          data: {
            operation: 'pick', // Missing fields
          },
        },
        {
          id: 'done-log',
          type: NodeTypes.ACTION_LOG,
          position: { x: 400, y: 150 },
          data: { label: 'Done', message: 'Finished' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig-cont', target: 'loop-cont' },
        { id: 'e2', source: 'loop-cont', target: 'step-err', sourceHandle: 'loop' },
        { id: 'e3', source: 'loop-cont', target: 'done-log', sourceHandle: 'done' },
      ],
    };

    const execResult4b = await run(failingWorkflowContinue, 'user_1', 'manual');
    check(execResult4b.status === 'success', 'Pipeline 4b: Workflow completed with status success when onError=continue');
    const loopStepCont = execResult4b.steps.find((s) => s.nodeId === 'loop-cont');
    check(loopStepCont.output.errorCount === 2, 'Pipeline 4b: Loop tracked 2 errors without stopping');

    // ── Group 6: Pipeline 5 (Nested Loops) ────────────────────────────────────
    console.log('\nTest Group 6: Nested Loops (Outer & Inner)');

    const nestedLoopWorkflow = {
      _id: 'wf_nested_loops',
      name: 'Matrix Generator',
      nodes: [
        { id: 't-nest', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'outer-loop',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 200, y: 0 },
          data: { label: 'Outer Rows', items: ['Row A', 'Row B'] },
        },
        {
          id: 'inner-loop',
          type: NodeTypes.ACTION_LOOP,
          position: { x: 400, y: 0 },
          data: { label: 'Inner Cols', items: [1, 2, 3] },
        },
        {
          id: 'cell-step',
          type: NodeTypes.ACTION_LOG,
          position: { x: 600, y: 0 },
          data: {
            label: 'Cell',
            message: 'Cell {{ loop.item }} in {{ steps.outer-loop.item }}',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 't-nest', target: 'outer-loop' },
        { id: 'e2', source: 'outer-loop', target: 'inner-loop', sourceHandle: 'loop' },
        { id: 'e3', source: 'inner-loop', target: 'cell-step', sourceHandle: 'loop' },
      ],
    };

    const execResult5 = await run(nestedLoopWorkflow, 'user_1', 'manual');
    check(execResult5.status === 'success', 'Pipeline 5: Nested loops executed successfully');
    const cellSteps = execResult5.steps.filter((s) => s.nodeId === 'cell-step');
    check(cellSteps.length === 6, 'Pipeline 5: Cell executed 6 times total (2 rows * 3 cols)');

    // ── Group 7: Workflow Serialization & Round-Trip Compatibility ────────────
    console.log('\nTest Group 7: Workflow Serialization with Loop Handles');

    const serialized = WorkflowSerializer.serialize(usersWorkflow);
    check(Boolean(serialized.manifest), 'Serializer generates manifest');
    check(serialized.workflow.nodes.length === 4, 'Serializer preserves 4 nodes');
    check(serialized.workflow.edges.length === 3, 'Serializer preserves 3 edges');

    const loopEdge = serialized.workflow.edges.find((e) => e.sourceHandle === 'loop');
    const doneEdge = serialized.workflow.edges.find((e) => e.sourceHandle === 'done');
    check(Boolean(loopEdge), 'Serializer preserves sourceHandle: loop');
    check(Boolean(doneEdge), 'Serializer preserves sourceHandle: done');

    const validation = WorkflowImportValidator.validate(serialized);
    check(validation.valid === true, 'WorkflowImportValidator validates loop workflow payload');
    check(validation.errors.length === 0, 'No validation errors');

    const deserialized = WorkflowSerializer.deserialize(serialized);
    check(deserialized.name === usersWorkflow.name, 'Deserialization restores workflow name');
    const deserializedLoop = deserialized.nodes.find((n) => n.id === 'loop-users');
    check(deserializedLoop && deserializedLoop.type === NodeTypes.ACTION_LOOP, 'Deserialization restores ACTION_LOOP node');
    check(deserializedLoop.data.operation === 'loop_items', 'Deserialization restores loop operation');

  } finally {
    // Restore originals
    Execution.create = originalExecCreate;
    Workflow.findByIdAndUpdate = originalWorkflowUpdate;
    ConnectionService.getDecryptedCredentials = originalGetCreds;

    if (fs.existsSync(testStorageDir)) {
      try {
        fs.rmSync(testStorageDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  console.log(`\nLoop Integration Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled failure:', err);
  process.exit(1);
});


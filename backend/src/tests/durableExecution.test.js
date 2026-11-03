/**
 * durableExecution.test.js
 *
 * End-to-End tests for Durable Execution, Checkpointing, and Resume System:
 * 1. Pause at Human Approval node and persistent checkpoint creation
 * 2. Secrets redaction in checkpoints (never stored plaintext)
 * 3. Resume with 'approved' decision (skips completed steps, executes Approved branch, skips Rejected branch)
 * 4. Resume with 'rejected' decision (executes Rejected branch, skips Approved branch)
 * 5. Wait node (event) pause, secure resumeToken generation, and resume by token
 * 6. Idempotent resumption guard (cannot resume already completed/resumed execution)
 * 7. Approver authorization enforcement (tenant / approver role / email verification)
 * 8. Automatic timeout sweep
 */

const assert = require('assert');
const workflowEngine = require('../services/workflowEngine');
const executionService = require('../services/executionService');
const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const WorkflowSecret = require('../models/WorkflowSecret');
const CredentialService = require('../services/CredentialService');
const { NodeTypes, BranchTypes, ExecutionStatus } = require('../constants');

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`);
    failed++;
  }
}

// In-memory mock database for Execution, Workflow, and WorkflowSecret
const mockDb = {
  executions: new Map(),
  workflows: new Map(),
  secrets: new Map(),
};

function setupMockDatabase() {
  Execution.create = async (doc) => {
    const id = doc._id || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const saved = {
      ...doc,
      _id: id,
      toObject: function () {
        return { ...this };
      },
      save: async function () {
        mockDb.executions.set(String(this._id), this);
        return this;
      },
    };
    mockDb.executions.set(String(id), saved);
    return saved;
  };

  Execution.findById = async (id) => {
    const exec = mockDb.executions.get(String(id));
    if (!exec) return null;
    return {
      ...exec,
      toObject: function () {
        return { ...this };
      },
      save: async function () {
        mockDb.executions.set(String(this._id), this);
        return this;
      },
      populate: function () {
        return this;
      },
    };
  };

  Execution.findOne = async (query) => {
    for (const exec of mockDb.executions.values()) {
      let matches = true;
      if (query._id && String(exec._id) !== String(query._id)) matches = false;
      if (query.owner && String(exec.owner) !== String(query.owner)) matches = false;
      if (query['wait.resumeToken'] && exec.wait?.resumeToken !== query['wait.resumeToken']) matches = false;
      if (matches) {
        return {
          ...exec,
          toObject: function () {
            return { ...this };
          },
          save: async function () {
            mockDb.executions.set(String(this._id), this);
            return this;
          },
          populate: function () {
            return this;
          },
        };
      }
    }
    return null;
  };

  Execution.find = async (query = {}) => {
    const list = [];
    for (const exec of mockDb.executions.values()) {
      let matches = true;
      if (query.status && exec.status !== query.status) matches = false;
      if (query['approval.status'] && exec.approval?.status !== query['approval.status']) matches = false;
      if (query['approval.timeoutAt']?.$lte) {
        if (!exec.approval?.timeoutAt || exec.approval.timeoutAt > query['approval.timeoutAt'].$lte) {
          matches = false;
        }
      }
      if (query['wait.status'] && exec.wait?.status !== query['wait.status']) matches = false;
      if (matches) {
        list.push({
          ...exec,
          toObject: function () {
            return { ...this };
          },
          save: async function () {
            mockDb.executions.set(String(this._id), this);
            return this;
          },
          populate: function () {
            return this;
          },
        });
      }
    }
    return {
      sort: () => ({
        limit: () => list,
        populate: () => list,
      }),
      populate: () => list,
      limit: () => list,
      then: (resolve) => resolve(list),
      [Symbol.iterator]: () => list[Symbol.iterator](),
    };
  };

  Workflow.findById = async (id) => mockDb.workflows.get(String(id)) || null;
  Workflow.findByIdAndUpdate = async (id, update) => mockDb.workflows.get(String(id)) || null;

  WorkflowSecret.find = async (query) => {
    const list = [];
    for (const sec of mockDb.secrets.values()) {
      if (String(sec.workflowId) === String(query.workflowId)) {
        list.push(sec);
      }
    }
    return list;
  };
}

async function runTests() {
  console.log('\n🧪 Starting Durable Execution & Resume Tests...\n');

  setupMockDatabase();

  const ownerId = 'user_alice_123';
  const ownerUser = { _id: ownerId, email: 'alice@example.com', role: 'admin' };
  const approverUser = { _id: 'user_bob_456', email: 'manager@example.com', role: 'manager' };
  const unauthorizedUser = { _id: 'user_eve_789', email: 'eve@external.com', role: 'guest' };

  // ── Test 1: Approval Workflow Pause & Checkpoint Creation ──────────────────
  console.log('Test 1: Approval Workflow Pause & Checkpoint Creation');

  const approvalWorkflow = {
    _id: 'wf_approval_test',
    name: 'Expense Approval Workflow',
    owner: ownerId,
    variables: [
      { name: 'expenseCategory', type: 'string', value: 'Software Subscription' },
      { name: 'amount', type: 'number', value: 1200 },
    ],
    nodes: [
      { id: 'node_start', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' }, position: { x: 0 } },
      {
        id: 'node_text_prep',
        type: NodeTypes.ACTION_TEXT,
        data: { label: 'Prepare Memo', operation: 'uppercase', input: 'Category: {{variables.expenseCategory}}' },
        position: { x: 100 },
      },
      {
        id: 'node_approval',
        type: NodeTypes.ACTION_APPROVAL,
        data: {
          label: 'Manager Approval',
          title: 'Approve Expense of ${{variables.amount}}',
          description: 'Category: {{variables.expenseCategory}}',
          message: 'Please review and approve',
          allowedApprovers: 'manager@example.com',
          approverRole: 'manager',
          timeoutMinutes: 120,
          timeoutAction: 'reject',
        },
        position: { x: 200 },
      },
      {
        id: 'node_text_approved',
        type: NodeTypes.ACTION_TEXT,
        data: { label: 'Approved Memo', operation: 'lowercase', input: 'APPROVED: ${{variables.amount}}' },
        position: { x: 300 },
      },
      {
        id: 'node_text_rejected',
        type: NodeTypes.ACTION_TEXT,
        data: { label: 'Rejected Memo', operation: 'lowercase', input: 'REJECTED: ${{variables.amount}}' },
        position: { x: 300 },
      },
    ],
    edges: [
      { id: 'e1', source: 'node_start', target: 'node_text_prep' },
      { id: 'e2', source: 'node_text_prep', target: 'node_approval' },
      { id: 'e3', source: 'node_approval', target: 'node_text_approved', sourceHandle: BranchTypes.APPROVED },
      { id: 'e4', source: 'node_approval', target: 'node_text_rejected', sourceHandle: BranchTypes.REJECTED },
    ],
  };

  mockDb.workflows.set(approvalWorkflow._id, approvalWorkflow);

  // Register encrypted secret to verify it NEVER leaks into checkpoint
  const encryptedSecVal = CredentialService.encrypt('SUPER_SECRET_TOKEN_DO_NOT_LEAK');
  mockDb.secrets.set('sec_1', {
    workflowId: approvalWorkflow._id,
    ownerId,
    name: 'FINANCE_API_KEY',
    encryptedValue: encryptedSecVal,
  });

  const pausedExec = await workflowEngine.run(approvalWorkflow, 'manual', {}, {}, ownerUser);

  check('Execution status is waiting_approval', pausedExec.status === ExecutionStatus.WAITING_APPROVAL);
  check('Checkpoint exists', Boolean(pausedExec.checkpoint));
  check('Checkpoint currentNodeId is node_approval', pausedExec.checkpoint.currentNodeId === 'node_approval');
  check('Checkpoint contains completedNodeIds', pausedExec.checkpoint.completedNodeIds.includes('node_text_prep'));
  check('Checkpoint variables preserved', pausedExec.checkpoint.variables.amount === 1200);

  // Security Check: Secret never in checkpoint
  const checkpointStr = JSON.stringify(pausedExec.checkpoint);
  check('Plaintext secret NEVER stored in checkpoint', !checkpointStr.includes('SUPER_SECRET_TOKEN_DO_NOT_LEAK'));

  check('Approval metadata created', Boolean(pausedExec.approval));
  check('Approval status is pending', pausedExec.approval.status === 'pending');
  check('Approval title resolved dynamically', pausedExec.approval.title === 'Approve Expense of $1200');
  check('Approval allowedApprovers includes manager@example.com', pausedExec.approval.allowedApprovers.includes('manager@example.com'));

  // Step history check: 3 steps recorded (start, prep, and waiting approval)
  check('Steps recorded up to approval', pausedExec.steps.length === 3);
  check('Approval step status is waiting', pausedExec.steps[2].status === 'waiting');

  // ── Test 2: Resume with Approved Decision ──────────────────────────────────
  console.log('\nTest 2: Resume with Approved Decision');

  // Attempt resume with unauthorized user
  let authErrorCaught = false;
  try {
    await workflowEngine.resume(pausedExec._id, { decision: 'approved', comments: 'Looks good' }, unauthorizedUser);
  } catch (err) {
    authErrorCaught = err.statusCode === 403 || err.message.includes('Unauthorized');
  }
  check('Unauthorized user blocked from approving (403 Forbidden)', authErrorCaught);

  // Resume with authorized approver
  const resumedApproved = await workflowEngine.resume(
    pausedExec._id,
    { decision: 'approved', comments: 'Approved by Bob' },
    approverUser
  );

  check('Resumed execution status is success', resumedApproved.status === ExecutionStatus.SUCCESS);
  check('Approval status is approved', resumedApproved.approval.status === 'approved');
  check('Approval decidedBy is Bob', resumedApproved.approval.decidedBy === 'manager@example.com');
  check('Approval comments preserved', resumedApproved.approval.comments === 'Approved by Bob');

  // Verify node branch traversal
  const approvedStep = resumedApproved.steps.find((s) => s.nodeId === 'node_text_approved');
  const rejectedStep = resumedApproved.steps.find((s) => s.nodeId === 'node_text_rejected');

  check('Approved branch node executed', Boolean(approvedStep) && approvedStep.status === ExecutionStatus.SUCCESS);
  check('Approved branch produced correct output', approvedStep.output.data.includes('approved: $1200'));
  check('Rejected branch node was SKIPPED', Boolean(rejectedStep) && rejectedStep.status === ExecutionStatus.SKIPPED);
  check('Skipped reason recorded', rejectedStep.output.skippedReason === 'Branch not selected');

  // Check that completed nodes were NOT duplicated or re-run
  const prepSteps = resumedApproved.steps.filter((s) => s.nodeId === 'node_text_prep');
  check('Initial step executed exactly once (not re-run)', prepSteps.length === 1);

  // Checkpoint cleared on complete
  check('Checkpoint cleared on execution finish', resumedApproved.checkpoint === null);

  // ── Test 3: Resume with Rejected Decision ──────────────────────────────────
  console.log('\nTest 3: Resume with Rejected Decision');

  // Run new instance
  const pausedExec2 = await workflowEngine.run(approvalWorkflow, 'manual', {}, {}, ownerUser);
  check('Second execution paused', pausedExec2.status === ExecutionStatus.WAITING_APPROVAL);

  // Resume with rejected
  const resumedRejected = await workflowEngine.resume(
    pausedExec2._id,
    { decision: 'rejected', comments: 'Budget exceeded' },
    approverUser
  );

  check('Resumed status is success', resumedRejected.status === ExecutionStatus.SUCCESS);
  check('Approval status is rejected', resumedRejected.approval.status === 'rejected');

  const approvedStep2 = resumedRejected.steps.find((s) => s.nodeId === 'node_text_approved');
  const rejectedStep2 = resumedRejected.steps.find((s) => s.nodeId === 'node_text_rejected');

  check('Approved branch SKIPPED on reject', Boolean(approvedStep2) && approvedStep2.status === ExecutionStatus.SKIPPED);
  check('Rejected branch EXECUTED on reject', Boolean(rejectedStep2) && rejectedStep2.status === ExecutionStatus.SUCCESS);
  check('Rejected branch produced correct output', rejectedStep2.output.data.includes('rejected: $1200'));

  // ── Test 4: Wait Node (Event) Pause & Resume by Token ──────────────────────
  console.log('\nTest 4: Wait Node (Event) Pause & Resume by Token');

  const waitWorkflow = {
    _id: 'wf_wait_test',
    name: 'Wait For Webhook Workflow',
    owner: ownerId,
    nodes: [
      { id: 'start_w', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' }, position: { x: 0 } },
      {
        id: 'wait_node',
        type: NodeTypes.ACTION_WAIT,
        data: { label: 'Wait for Callback', waitType: 'event', eventName: 'shipment.delivered', timeoutMinutes: 60 },
        position: { x: 100 },
      },
      {
        id: 'post_wait_text',
        type: NodeTypes.ACTION_TEXT,
        data: { label: 'Process Shipment', operation: 'uppercase', input: 'Processed shipment successfully' },
        position: { x: 200 },
      },
    ],
    edges: [
      { id: 'ew1', source: 'start_w', target: 'wait_node' },
      { id: 'ew2', source: 'wait_node', target: 'post_wait_text' },
    ],
  };

  mockDb.workflows.set(waitWorkflow._id, waitWorkflow);

  const pausedWaitExec = await workflowEngine.run(waitWorkflow, 'manual', {}, {}, ownerUser);

  check('Wait execution status is paused', pausedWaitExec.status === ExecutionStatus.PAUSED);
  check('Wait metadata exists', Boolean(pausedWaitExec.wait));
  check('Wait status is waiting', pausedWaitExec.wait.status === 'waiting');
  check('Secure resumeToken generated', typeof pausedWaitExec.wait.resumeToken === 'string');

  const resumeToken = pausedWaitExec.wait.resumeToken;

  // Resume using resumeByToken (external event)
  const resumedWait = await executionService.resumeByToken(resumeToken, {
    trackingNumber: 'TRK-999-XYZ',
    status: 'delivered',
  });

  check('Resumed wait execution status is success', resumedWait.status === ExecutionStatus.SUCCESS);
  check('Wait status updated to resumed', resumedWait.wait.status === 'resumed');
  check('Downstream post-wait node executed', resumedWait.steps.some((s) => s.nodeId === 'post_wait_text' && s.status === ExecutionStatus.SUCCESS));

  // ── Test 5: Idempotent Resumption Guard ────────────────────────────────────
  console.log('\nTest 5: Idempotent Resumption Guard');

  let duplicateResumeError = false;
  try {
    await executionService.resumeByToken(resumeToken, { extra: 'retry' });
  } catch (err) {
    duplicateResumeError = err.message.includes('no longer in a waiting state') || err.message.includes('Invalid resume token');
  }
  check('Duplicate resume call safely rejected (idempotent)', duplicateResumeError);

  // ── Test 6: Auto-Sweep Timeout ─────────────────────────────────────────────
  console.log('\nTest 6: Auto-Sweep Timeout');

  // Create an expired execution
  const expiredApprovalWorkflow = {
    _id: 'wf_expired_test',
    name: 'Expired Approval Workflow',
    owner: ownerId,
    nodes: [
      { id: 'exp_start', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } },
      {
        id: 'exp_approval',
        type: NodeTypes.ACTION_APPROVAL,
        data: {
          label: 'Quick Approval',
          title: 'Quick Approval',
          timeoutMinutes: 1,
          timeoutAction: 'reject',
        },
      },
    ],
    edges: [{ id: 'ee1', source: 'exp_start', target: 'exp_approval' }],
  };

  mockDb.workflows.set(expiredApprovalWorkflow._id, expiredApprovalWorkflow);
  const toExpire = await workflowEngine.run(expiredApprovalWorkflow, 'manual', {}, {}, ownerUser);

  // Artificially move timeoutAt into the past
  toExpire.approval.timeoutAt = new Date(Date.now() - 60000);
  await toExpire.save();

  // Trigger sweep
  const swept = await executionService.sweepTimeouts();

  check('Sweep found and auto-resolved expired execution', swept.length > 0);
  const updatedExpired = await Execution.findById(toExpire._id);
  check('Auto-resolved execution status is success', updatedExpired.status === ExecutionStatus.SUCCESS);
  check('Approval status set to timeout', updatedExpired.approval.status === 'timeout');
  check('Auto-resolved with timeoutAction reject', updatedExpired.approval.decision === 'reject');

  console.log(`\nDurable Execution Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


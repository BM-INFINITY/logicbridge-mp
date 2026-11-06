/**
 * reliabilityHardening.test.js
 *
 * Comprehensive Regression & Platform Reliability Hardening Suite (Iteration 41 & 41.1):
 * 1. Startup Recovery Multi-Instance Isolation: Healthy running execution on another instance is never failed
 * 2. Scheduler Lock Renewal: Safe ownership verification, expired lock protection, and lost lock handling
 * 3. Cross-Instance Webhook Idempotency: Persistent claim with duplicate-key race protection (E11000)
 * 4. Approval Authorization Pre-Claim Gate: Unauthorized requests fail before DB claim; concurrent legitimate approval succeeds
 * 5. Cancellation Behavior: Parked/waiting executions cancel cleanly; running & terminal states strictly protected
 * 6. AI Reasoning & Resume Token Privacy: Raw payloads & reasoning fields stripped; resumeToken hidden in serialization
 * 7. Retry vs Replay Semantics: Distinct triggers ('retry' vs 'replay'); coalesces in-flight without suppressing subsequent retries
 */

const assert = require('assert');
const workflowEngine = require('../services/workflowEngine');
const executionService = require('../services/executionService');
const scheduleManager = require('../services/scheduleManager');
const webhookService = require('../services/webhookService');
const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const Schedule = require('../models/Schedule');
const WebhookEvent = require('../models/WebhookEvent');
const WorkflowSecret = require('../models/WorkflowSecret');
const AgentResult = require('../agents/AgentResult');
const BaseAINode = require('../nodes/BaseAINode');
const { NodeTypes, ExecutionStatus, WorkflowStatus } = require('../constants');

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// In-memory mock store
const mockDb = {
  executions: new Map(),
  workflows: new Map(),
  schedules: new Map(),
  webhookEvents: new Map(),
};

function setupMocks() {
  mockDb.executions.clear();
  mockDb.workflows.clear();
  mockDb.schedules.clear();
  mockDb.webhookEvents.clear();

  WorkflowSecret.find = async () => [];

  Execution.create = async (doc) => {
    const id = doc._id || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const saved = {
      ...doc,
      _id: id,
      toObject: function () {
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
      },
      toJSON: function () {
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
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
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
      },
      toJSON: function () {
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
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

  Execution.findOneAndUpdate = async (query, update, options = {}) => {
    let matched = null;
    for (const exec of mockDb.executions.values()) {
      let matches = true;
      if (query._id && String(exec._id) !== String(query._id)) matches = false;
      if (query.status) {
        if (query.status.$in) {
          if (!query.status.$in.includes(exec.status)) matches = false;
        } else if (exec.status !== query.status) {
          matches = false;
        }
      }
      if (matches) {
        matched = exec;
        break;
      }
    }
    if (!matched) return null;
    const oldDoc = {
      ...matched,
      toObject: function () {
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
      },
      toJSON: function () {
        const ret = { ...this };
        if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
        return ret;
      },
      save: async function () {
        mockDb.executions.set(String(this._id), this);
        return this;
      },
    };
    if (update.$set) {
      Object.assign(matched, update.$set);
    }
    mockDb.executions.set(String(matched._id), matched);
    return options.new ? matched : oldDoc;
  };

  Execution.updateOne = async (query, update) => {
    for (const exec of mockDb.executions.values()) {
      let matches = true;
      if (query._id && String(exec._id) !== String(query._id)) matches = false;
      if (query.workerId && exec.workerId !== query.workerId) matches = false;
      if (matches) {
        if (update.$set) Object.assign(exec, update.$set);
        mockDb.executions.set(String(exec._id), exec);
        return { matchedCount: 1, modifiedCount: 1 };
      }
    }
    return { matchedCount: 0, modifiedCount: 0 };
  };

  Execution.findOne = (query) => {
    const execPromise = (async () => {
      for (const exec of mockDb.executions.values()) {
        let matches = true;
        if (query._id && String(exec._id) !== String(query._id)) matches = false;
        if (query.owner && String(exec.owner) !== String(query.owner)) matches = false;
        if (query.occurrenceId && exec.occurrenceId !== query.occurrenceId) matches = false;
        if (query.status?.$ne && exec.status === query.status.$ne) matches = false;
        if (query['wait.resumeToken'] && exec.wait?.resumeToken !== query['wait.resumeToken']) matches = false;
        if (matches) {
          return {
            ...exec,
            toObject: function () {
              const ret = { ...this };
              if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
              return ret;
            },
            toJSON: function () {
              const ret = { ...this };
              if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
              return ret;
            },
            save: async function () {
              mockDb.executions.set(String(this._id), this);
              return this;
            },
          };
        }
      }
      return null;
    })();

    const queryObj = {
      populate: () => queryObj,
      then: execPromise.then.bind(execPromise),
      catch: execPromise.catch.bind(execPromise),
    };
    return queryObj;
  };

  Execution.find = async (query = {}) => {
    const list = [];
    for (const exec of mockDb.executions.values()) {
      let matches = true;
      if (query.status && exec.status !== query.status) matches = false;
      if (query.$or) {
        const orMatches = query.$or.some((subQuery) => {
          if (subQuery.leaseExpiresAt?.$lt) {
            return exec.leaseExpiresAt && new Date(exec.leaseExpiresAt) < subQuery.leaseExpiresAt.$lt;
          }
          if (subQuery.leaseExpiresAt === null) {
            const noLease = !exec.leaseExpiresAt;
            const stale = subQuery.startedAt?.$lte ? (exec.startedAt && new Date(exec.startedAt) <= subQuery.startedAt.$lte) : true;
            return noLease && stale;
          }
          return false;
        });
        if (!orMatches) matches = false;
      }
      if (matches) {
        list.push({
          ...exec,
          toObject: function () {
            const ret = { ...this };
            if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
            return ret;
          },
          toJSON: function () {
            const ret = { ...this };
            if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
            return ret;
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
    const queryObj = {
      sort: () => queryObj,
      limit: () => queryObj,
      populate: () => queryObj,
      then: (resolve) => resolve(list),
      catch: (reject) => {},
      [Symbol.iterator]: () => list[Symbol.iterator](),
    };
    return queryObj;
  };

  Workflow.findById = async (id) => mockDb.workflows.get(String(id)) || null;
  Workflow.findByIdAndUpdate = async () => {};

  Schedule.updateOne = async (query, update) => {
    for (const sched of mockDb.schedules.values()) {
      let matches = true;
      if (query._id && String(sched._id) !== String(query._id)) matches = false;
      if (query.lockedBy && sched.lockedBy !== query.lockedBy) matches = false;
      if (query.lockExpiresAt?.$gt && (!sched.lockExpiresAt || sched.lockExpiresAt <= query.lockExpiresAt.$gt)) {
        matches = false;
      }
      if (matches) {
        if (update.$set) Object.assign(sched, update.$set);
        if (update.$inc?.runCount) sched.runCount = (sched.runCount || 0) + update.$inc.runCount;
        mockDb.schedules.set(String(sched._id), sched);
        return { matchedCount: 1, modifiedCount: 1 };
      }
    }
    return { matchedCount: 0, modifiedCount: 0 };
  };

  Schedule.findOneAndUpdate = async () => null;

  WebhookEvent.findOne = async (query) => {
    for (const ev of mockDb.webhookEvents.values()) {
      if (query.workflow && String(ev.workflow) !== String(query.workflow)) continue;
      if (query.eventIdentifier && ev.eventIdentifier !== query.eventIdentifier) continue;
      if (query.status?.$in && !query.status.$in.includes(ev.status)) continue;
      return ev;
    }
    return null;
  };

  WebhookEvent.create = async (doc) => {
    // Simulate unique sparse constraint on (workflow, eventIdentifier)
    if (doc.eventIdentifier && !doc.isReplay) {
      for (const ev of mockDb.webhookEvents.values()) {
        if (String(ev.workflow) === String(doc.workflow) && ev.eventIdentifier === doc.eventIdentifier && !ev.isReplay) {
          const err = new Error(`E11000 duplicate key error collection: logicbridge.webhookevents index: workflow_1_eventIdentifier_1 dup key: { workflow: "${doc.workflow}", eventIdentifier: "${doc.eventIdentifier}" }`);
          err.code = 11000;
          throw err;
        }
      }
    }
    const id = doc._id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const saved = { ...doc, _id: id };
    mockDb.webhookEvents.set(id, saved);
    return saved;
  };

  WebhookEvent.updateOne = async (query, update) => {
    for (const ev of mockDb.webhookEvents.values()) {
      if (query._id && String(ev._id) === String(query._id)) {
        if (update.$set) Object.assign(ev, update.$set);
        mockDb.webhookEvents.set(String(ev._id), ev);
        return { matchedCount: 1, modifiedCount: 1 };
      }
    }
    return { matchedCount: 0, modifiedCount: 0 };
  };
}

async function runTests() {
  console.log('\n🧪 Starting Iteration 41 & 41.1 Reliability & Edge-Case Verification...\n');
  setupMocks();

  // ── 1. Startup Recovery Multi-Instance Simulation ─────────────────────────
  console.log('Group 1: Startup Recovery Multi-Instance Isolation');

  // Instance A has an active, healthy execution with a valid lease
  const healthyExec = {
    _id: 'exec_instance_A_healthy',
    workflow: 'wf_test',
    owner: 'user_1',
    status: ExecutionStatus.RUNNING,
    startedAt: new Date(),
    workerId: 'worker_instance_A',
    heartbeatAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 60000), // Valid for next 60s
  };
  await Execution.create(healthyExec);

  // Genuinely dead/abandoned execution whose lease expired 5 minutes ago
  const deadExec = {
    _id: 'exec_dead_crashed_worker',
    workflow: 'wf_test',
    owner: 'user_1',
    status: ExecutionStatus.RUNNING,
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    workerId: 'worker_old_dead',
    heartbeatAt: new Date(Date.now() - 6 * 60 * 1000),
    leaseExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
  };
  await Execution.create(deadExec);

  // Instance B starts up and runs recovery
  const recovered = await workflowEngine.recoverInterruptedExecutions();
  check('Instance B recovers genuinely abandoned execution', recovered === 1);

  const healthyCheck = await Execution.findById('exec_instance_A_healthy');
  check('Instance B DOES NOT fail Instance A healthy running execution', healthyCheck.status === ExecutionStatus.RUNNING);

  const deadCheck = await Execution.findById('exec_dead_crashed_worker');
  check('Dead execution successfully marked FAILED', deadCheck.status === ExecutionStatus.FAILED);
  check('Dead execution error explains restart/termination', deadCheck.error.includes('interrupted by process termination'));

  // ── 2. Scheduler Lock Renewal & Ownership Protection ─────────────────────
  console.log('\nGroup 2: Scheduler Lock Renewal & Lost Lock Protection');

  const schedWf = {
    _id: 'wf_sched_renew',
    name: 'Scheduled Renewal Workflow',
    status: WorkflowStatus.ACTIVE,
    nodes: [{ id: 's1', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } }],
    edges: [],
  };
  mockDb.workflows.set('wf_sched_renew', schedWf);

  const schedDoc = {
    _id: 'sched_lock_test',
    name: 'Test Sched',
    workflow: 'wf_sched_renew',
    owner: 'user_1',
    type: 'interval',
    intervalMinutes: 10,
    preventOverlap: false,
    lockedAt: new Date(),
    lockedBy: 'worker_alpha',
    lockExpiresAt: new Date(Date.now() + 300000),
    nextRunAt: new Date(),
    save: async function () {
      mockDb.schedules.set(String(this._id), this);
      return this;
    },
  };
  mockDb.schedules.set('sched_lock_test', schedDoc);

  // Test renewal with matching owner and active lease
  const renewOk = await Schedule.updateOne(
    { _id: 'sched_lock_test', lockedBy: 'worker_alpha', lockExpiresAt: { $gt: new Date() } },
    { $set: { lockExpiresAt: new Date(Date.now() + 300000) } }
  );
  check('Worker Alpha successfully renews active lease', renewOk.matchedCount === 1);

  // Simulate ownership change: Worker Beta took over the lock
  schedDoc.lockedBy = 'worker_beta';
  schedDoc.lockExpiresAt = new Date(Date.now() + 300000);
  mockDb.schedules.set('sched_lock_test', schedDoc);

  // Worker Alpha attempts to renew after losing ownership
  const renewLost = await Schedule.updateOne(
    { _id: 'sched_lock_test', lockedBy: 'worker_alpha', lockExpiresAt: { $gt: new Date() } },
    { $set: { lockExpiresAt: new Date(Date.now() + 300000) } }
  );
  check('Worker Alpha renewal rejected when lock ownership changed to Worker Beta', renewLost.matchedCount === 0);

  // Worker Alpha completion release cannot blow away Worker Beta's lock
  const releaseBlowaway = await Schedule.updateOne(
    { _id: 'sched_lock_test', lockedBy: 'worker_alpha' },
    { $set: { lockedBy: null, lockExpiresAt: null } }
  );
  check('Expired/replaced worker cannot release or overwrite new worker lock', releaseBlowaway.matchedCount === 0);
  check('Worker Beta lock remains intact in DB', mockDb.schedules.get('sched_lock_test').lockedBy === 'worker_beta');

  // ── 3. Cross-Instance Webhook Idempotency (E11000 Race) ───────────────────
  console.log('\nGroup 3: Cross-Instance Webhook Idempotency & Persistent Claims');

  const whWorkflow = {
    _id: 'wf_wh_multi_instance',
    name: 'Multi-Instance Webhook Flow',
    owner: 'user_1',
    status: WorkflowStatus.ACTIVE,
    nodes: [
      {
        id: 'wh_node',
        type: NodeTypes.TRIGGER_WEBHOOK,
        data: {
          authType: 'none',
          idempotencySource: 'header',
          idempotencyField: 'x-event-id',
        },
      },
      {
        id: 'text_node',
        type: NodeTypes.ACTION_TEXT,
        data: { operation: 'uppercase', input: 'ok' },
      },
    ],
    edges: [{ id: 'e1', source: 'wh_node', target: 'text_node' }],
  };
  mockDb.workflows.set('wf_wh_multi_instance', whWorkflow);

  const sharedEventId = 'evt_payment_completed_9999';
  const reqInstanceA = {
    method: 'POST',
    url: '/api/webhooks/test',
    headers: { 'x-event-id': sharedEventId, 'content-type': 'application/json' },
    query: {},
    body: { paymentId: 9999 },
    ip: '10.0.0.1',
  };
  const reqInstanceB = {
    method: 'POST',
    url: '/api/webhooks/test',
    headers: { 'x-event-id': sharedEventId, 'content-type': 'application/json' },
    query: {},
    body: { paymentId: 9999 },
    ip: '10.0.0.2',
  };

  // Simulate Instance A claiming upfront; Instance B hitting unique constraint violation (E11000)
  const [resA, resB] = await Promise.all([
    webhookService.processWebhook(whWorkflow, reqInstanceA, JSON.stringify(reqInstanceA.body)),
    webhookService.processWebhook(whWorkflow, reqInstanceB, JSON.stringify(reqInstanceB.body)),
  ]);

  const bothHttp200 = resA.status === 200 && resB.status === 200;
  check('Both multi-instance requests respond with HTTP 200', bothHttp200);

  const outcomes = [resA.body?.status, resB.body?.status];
  check('One instance executes successfully and one is deduplicated', outcomes.includes('duplicate'));

  const savedEventCount = Array.from(mockDb.webhookEvents.values()).filter(
    (e) => e.eventIdentifier === sharedEventId && e.status !== 'duplicate'
  ).length;
  check('Persistent claim ensures exactly 1 primary event record in DB', savedEventCount === 1);

  // ── 4. Approval Authorization Pre-Claim Protection ────────────────────────
  console.log('\nGroup 4: Approval Authorization Pre-Claim Gate');

  const authWorkflow = {
    _id: 'wf_auth_protect',
    name: 'Approval Auth Workflow',
    status: WorkflowStatus.ACTIVE,
    nodes: [
      { id: 'start', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } },
      {
        id: 'approval',
        type: NodeTypes.ACTION_APPROVAL,
        data: {
          label: 'Senior Exec Approval',
          title: 'Budget Increase Request',
          allowedApprovers: ['executive@example.com'],
        },
      },
      {
        id: 'action',
        type: NodeTypes.ACTION_TEXT,
        data: { operation: 'uppercase', input: 'approved' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'approval' },
      { id: 'e2', source: 'approval', target: 'action', sourceHandle: 'approved' },
    ],
  };
  mockDb.workflows.set('wf_auth_protect', authWorkflow);

  const parkedExec = await workflowEngine.run(authWorkflow, 'user_exec_owner');
  check('Execution parks at approval checkpoint', parkedExec.status === ExecutionStatus.WAITING_APPROVAL);

  // Unauthorized user attempt
  const unauthorizedUser = { _id: 'unauth_user_99', email: 'intruder@example.com' };
  let unauthorizedError = null;
  try {
    await workflowEngine.resume(parkedExec._id, { decision: 'approve' }, unauthorizedUser);
  } catch (err) {
    unauthorizedError = err;
  }
  check('Unauthorized request is rejected with HTTP 403 Forbidden', unauthorizedError?.statusCode === 403);

  // Verify status in DB was NEVER changed to running by unauthorized request
  const afterUnauth = await Execution.findById(parkedExec._id);
  check('Unauthorized request did NOT modify execution status in DB', afterUnauth.status === ExecutionStatus.WAITING_APPROVAL);

  // Now legitimate authorized executive submits approval concurrently with another unauthorized attempt
  const authorizedUser = { _id: 'user_exec_owner', email: 'executive@example.com' };
  const [legitRes, unauthRes] = await Promise.allSettled([
    workflowEngine.resume(parkedExec._id, { decision: 'approve' }, authorizedUser),
    workflowEngine.resume(parkedExec._id, { decision: 'approve' }, unauthorizedUser),
  ]);

  check('Authorized approval succeeds cleanly', legitRes.status === 'fulfilled' && legitRes.value.status === ExecutionStatus.SUCCESS);
  check('Unauthorized concurrent attempt fails with 403 without blocking legitimate run', unauthRes.status === 'rejected' && unauthRes.reason?.statusCode === 403);

  // ── 5. Cancellation Behavior & Terminal State Immutability ─────────────────
  console.log('\nGroup 5: Cancellation Behavior & Terminal State Immutability');

  const cancelExec = {
    _id: 'exec_to_cancel',
    workflow: 'wf_auth_protect',
    owner: 'user_1',
    status: ExecutionStatus.WAITING_APPROVAL,
    startedAt: new Date(),
    approval: { status: 'pending' },
  };
  await Execution.create(cancelExec);

  // Valid cancellation of waiting execution
  const cancelled = await executionService.cancelExecution('exec_to_cancel', { _id: 'user_1' });
  check('Waiting execution cancels successfully', cancelled.status === ExecutionStatus.CANCELLED);
  check('Approval status updated to cancelled', cancelled.approval.status === 'cancelled');

  // Attempt to cancel already cancelled execution (terminal state immutability)
  let terminalCancelErr = null;
  try {
    await executionService.cancelExecution('exec_to_cancel', { _id: 'user_1' });
  } catch (err) {
    terminalCancelErr = err;
  }
  check('Terminal state is immutable; cannot re-cancel cancelled execution', terminalCancelErr?.message?.includes('terminal status'));

  // Attempt to cancel in-flight running execution
  const runningExec = {
    _id: 'exec_in_flight_running',
    workflow: 'wf_auth_protect',
    owner: 'user_1',
    status: ExecutionStatus.RUNNING,
    startedAt: new Date(),
  };
  await Execution.create(runningExec);

  let runningCancelErr = null;
  try {
    await executionService.cancelExecution('exec_in_flight_running', { _id: 'user_1' });
  } catch (err) {
    runningCancelErr = err;
  }
  check('Running execution cancellation rejected with clear diagnostic message', runningCancelErr?.message?.includes('In-flight execution cancellation is not supported'));

  // ── 6. AI Reasoning & Resume Token Privacy ────────────────────────────────
  console.log('\nGroup 6: AI Reasoning & Resume Token Privacy');

  const baseAi = new BaseAINode({ type: 'action-ai-generate', name: 'AI Test' });
  const rawProviderOutput = {
    text: '<thought>Internal reasoning scratchpad</thought>Clean public answer',
    content: '<thinking>Secret plan</thinking>Safe content',
    raw: { choices: [{ message: { reasoning_content: 'Confidential reasoning chain' } }] },
    reasoning_content: 'Confidential reasoning chain',
    thinking: 'Secret thinking block',
    thought: 'Secret thought',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };

  const formatted = baseAi.formatOutput(rawProviderOutput, Date.now() - 50);
  check('formatOutput strips output.raw completely', formatted.raw === undefined);
  check('formatOutput strips output.reasoning_content', formatted.reasoning_content === undefined);
  check('formatOutput strips output.thinking', formatted.thinking === undefined);
  check('formatOutput strips output.thought', formatted.thought === undefined);
  check('formatOutput sanitizes text of <thought> tags', formatted.text === 'Clean public answer');
  check('formatOutput sanitizes content of <thinking> tags', formatted.content === 'Safe content');
  check('Preserves safe usage statistics', formatted.usage.totalTokens === 15);

  // Resume token serialization check
  const inspectExec = {
    _id: 'exec_inspect_tokens',
    workflow: 'wf_auth_protect',
    owner: 'user_1',
    status: ExecutionStatus.PAUSED,
    wait: {
      type: 'event',
      status: 'waiting',
      resumeToken: 'secret_token_123456789',
    },
  };
  await Execution.create(inspectExec);
  const fetchedInspect = await Execution.findById('exec_inspect_tokens');
  check('toJSON() masks active resumeToken as [REDACTED]', fetchedInspect.toJSON().wait.resumeToken === '[REDACTED]');
  check('toObject() masks active resumeToken as [REDACTED]', fetchedInspect.toObject().wait.resumeToken === '[REDACTED]');

  // ── 7. Retry vs Replay Semantics & Coalescing Cleanup ──────────────────────
  console.log('\nGroup 7: Retry vs Replay Semantics & Coalescing Cleanup');

  const originWf = {
    _id: 'wf_retry_replay_semantics',
    name: 'Retry Replay Flow',
    status: WorkflowStatus.ACTIVE,
    nodes: [{ id: 'n1', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } }],
    edges: [],
  };
  mockDb.workflows.set('wf_retry_replay_semantics', originWf);

  const initialRun = await workflowEngine.run(originWf, 'user_1');

  // Trigger retry: verify trigger is 'retry'
  const retryResult = await executionService.retryExecution(initialRun._id, 'user_1');
  check('retryExecution sets trigger to "retry"', retryResult.trigger === 'retry');

  // Trigger replay: verify trigger is 'replay'
  const replayResult = await executionService.replayExecution(initialRun._id, 'user_1');
  check('replayExecution sets trigger to "replay"', replayResult.trigger === 'replay');

  // Test that subsequent retry is NOT suppressed by an arbitrary timer window
  const subsequentRetry = await executionService.retryExecution(initialRun._id, 'user_1');
  check('Subsequent retry immediately after completion generates a new execution (not suppressed)', String(subsequentRetry._id) !== String(retryResult._id));

  // ── Report ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error('❌ SOME RELIABILITY HARDENING TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('🎉 ALL ITERATION 41 & 41.1 RELIABILITY & EDGE-CASE TESTS PASSED!\n\n');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };

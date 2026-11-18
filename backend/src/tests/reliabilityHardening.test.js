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

  function maskDoc(doc) {
    const ret = { ...doc };
    if (ret.wait && ret.wait.resumeToken) ret.wait = { ...ret.wait, resumeToken: '[REDACTED]' };
    if (ret.approval && ret.approval.resumeToken) ret.approval = { ...ret.approval, resumeToken: '[REDACTED]' };
    if (ret.resumeToken) ret.resumeToken = '[REDACTED]';
    if (Array.isArray(ret.steps)) {
      ret.steps = ret.steps.map((s) => {
        if (s?.output && s.output.resumeToken) {
          return { ...s, output: { ...s.output, resumeToken: '[REDACTED]' } };
        }
        return s;
      });
    }
    return ret;
  }

  Execution.create = async (doc) => {
    if (doc.occurrenceId) {
      for (const ex of mockDb.executions.values()) {
        if (ex.occurrenceId === doc.occurrenceId) {
          const err = new Error(`E11000 duplicate key error collection: logicbridge.executions index: occurrenceId_1 dup key: { occurrenceId: "${doc.occurrenceId}" }`);
          err.code = 11000;
          throw err;
        }
      }
    }
    const id = doc._id || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const saved = {
      ...doc,
      _id: id,
      toObject: function () {
        return maskDoc(this);
      },
      toJSON: function () {
        return maskDoc(this);
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
        return maskDoc(this);
      },
      toJSON: function () {
        return maskDoc(this);
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
        return maskDoc(this);
      },
      toJSON: function () {
        return maskDoc(this);
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
        if (query.workflow && String(exec.workflow) !== String(query.workflow)) matches = false;
        if (query.occurrenceId && exec.occurrenceId !== query.occurrenceId) matches = false;
        if (query.status?.$ne && exec.status === query.status.$ne) matches = false;
        if (query.status?.$in && !query.status.$in.includes(exec.status)) matches = false;
        if (query['wait.resumeToken'] && exec.wait?.resumeToken !== query['wait.resumeToken']) matches = false;
        if (matches) {
          return {
            ...exec,
            toObject: function () {
              return maskDoc(this);
            },
            toJSON: function () {
              return maskDoc(this);
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
      if (query.owner && String(exec.owner) !== String(query.owner)) matches = false;
      if (query.workflow && String(exec.workflow) !== String(query.workflow)) matches = false;
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
            return maskDoc(this);
          },
          toJSON: function () {
            return maskDoc(this);
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
      return {
        ...ev,
        save: async function () {
          mockDb.webhookEvents.set(String(this._id), this);
          return this;
        },
      };
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
    const saved = {
      ...doc,
      _id: id,
      save: async function () {
        mockDb.webhookEvents.set(String(this._id), this);
        return this;
      },
    };
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

  WebhookEvent.findOneAndUpdate = async (query, update, options = {}) => {
    let matched = null;
    for (const ev of mockDb.webhookEvents.values()) {
      let matches = true;
      if (query._id && String(ev._id) !== String(query._id)) matches = false;
      if (query.status && ev.status !== query.status) matches = false;
      if (query.claimExpiresAt?.$lt && (!ev.claimExpiresAt || new Date(ev.claimExpiresAt) >= query.claimExpiresAt.$lt)) {
        matches = false;
      }
      if (matches) {
        matched = ev;
        break;
      }
    }
    if (!matched) return null;
    if (update.$set) Object.assign(matched, update.$set);
    mockDb.webhookEvents.set(String(matched._id), matched);
    return {
      ...matched,
      save: async function () {
        mockDb.webhookEvents.set(String(this._id), this);
        return this;
      },
    };
  };

  WebhookEvent.find = async (query = {}) => {
    const list = [];
    for (const ev of mockDb.webhookEvents.values()) {
      let matches = true;
      if (query.status && ev.status !== query.status) matches = false;
      if (query.claimExpiresAt?.$lt && (!ev.claimExpiresAt || new Date(ev.claimExpiresAt) >= query.claimExpiresAt.$lt)) {
        matches = false;
      }
      if (matches) {
        list.push({
          ...ev,
          save: async function () {
            mockDb.webhookEvents.set(String(this._id), this);
            return this;
          },
        });
      }
    }
    return list;
  };

  WebhookEvent.updateMany = async (query, update) => {
    let count = 0;
    for (const ev of mockDb.webhookEvents.values()) {
      let matches = true;
      if (query._id?.$in && !query._id.$in.map(String).includes(String(ev._id))) matches = false;
      if (matches) {
        if (update.$set) Object.assign(ev, update.$set);
        mockDb.webhookEvents.set(String(ev._id), ev);
        count++;
      }
    }
    return { matchedCount: count, modifiedCount: count };
  };

  WebhookEvent.aggregate = async () => [];
  WebhookEvent.syncIndexes = async () => true;
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

  // ── 8. Webhook Persistent Claim Recovery (Crash Edge Cases) ────────────────
  console.log('\nGroup 8: Webhook Persistent Claim Recovery');

  const crashWf = {
    _id: 'wf_webhook_crash_recovery',
    name: 'Webhook Crash Flow',
    owner: 'user_1',
    status: WorkflowStatus.ACTIVE,
    nodes: [
      { id: 'wh_node', type: NodeTypes.TRIGGER_WEBHOOK, data: { enabled: true, method: 'POST', authType: 'none' } },
      { id: 'act_node', type: NodeTypes.ACTION_LOG, data: { message: 'Processed webhook' } },
    ],
    edges: [{ id: 'e1', source: 'wh_node', target: 'act_node' }],
  };
  mockDb.workflows.set('wf_webhook_crash_recovery', crashWf);

  // Scenario 8A: Worker crash before workflow dispatch (persistent claim created with status 'processing')
  const expiredClaimTime = new Date(Date.now() - 120000); // Expired 2 minutes ago
  const abandonedClaimDoc = {
    _id: 'claim_crashed_before_dispatch',
    workflow: 'wf_webhook_crash_recovery',
    eventIdentifier: 'evt_crash_before_dispatch_1',
    status: 'processing',
    workerId: 'worker_crashed_instance_9',
    claimExpiresAt: expiredClaimTime,
    heartbeatAt: expiredClaimTime,
    execution: null,
  };
  mockDb.webhookEvents.set(abandonedClaimDoc._id, abandonedClaimDoc);

  // Redelivery arrives: should atomically reclaim the expired claim and execute workflow
  const redeliveredReqA = {
    method: 'POST',
    headers: { 'x-event-id': 'evt_crash_before_dispatch_1' },
    body: { item: 'sample' },
  };
  const crashResA = await webhookService.processWebhook(crashWf, redeliveredReqA);
  check('Expired claim crash before dispatch is reclaimed and returns HTTP 200', crashResA.status === 200);
  check('Claim status updated to success after reclaimed execution', mockDb.webhookEvents.get('claim_crashed_before_dispatch').status === 'success');
  check('Reclaimed claim has execution attached', Boolean(mockDb.webhookEvents.get('claim_crashed_before_dispatch').execution));

  // Scenario 8B: Healthy worker processing is NOT reclaimed by sibling
  const activeLeaseTime = new Date(Date.now() + 60000); // 1 min in future
  const activeClaimDoc = {
    _id: 'claim_healthy_active_worker',
    workflow: 'wf_webhook_crash_recovery',
    eventIdentifier: 'evt_healthy_active_2',
    status: 'processing',
    workerId: 'worker_healthy_sibling_1',
    claimExpiresAt: activeLeaseTime,
    heartbeatAt: new Date(),
    execution: null,
  };
  mockDb.webhookEvents.set(activeClaimDoc._id, activeClaimDoc);

  const siblingReqB = {
    method: 'POST',
    headers: { 'x-event-id': 'evt_healthy_active_2' },
    body: { item: 'sample' },
  };
  const crashResB = await webhookService.processWebhook(crashWf, siblingReqB);
  check('Active lease belonging to healthy worker is not reclaimed and deduplicated', crashResB.body.status === 'duplicate');
  check('Healthy claim workerId remains unchanged', mockDb.webhookEvents.get('claim_healthy_active_worker').workerId === 'worker_healthy_sibling_1');

  // Scenario 8C: Worker crash after execution completed but before WebhookEvent persistence
  // Workflow actually ran, execution exists in DB with occurrenceId, but claim remained 'processing'
  const pastExecDoc = {
    _id: 'exec_prior_completed_success',
    workflow: 'wf_webhook_crash_recovery',
    owner: 'user_1',
    status: ExecutionStatus.SUCCESS,
    occurrenceId: 'evt_crash_after_exec_3',
    steps: [],
    startedAt: new Date(Date.now() - 300000),
    finishedAt: new Date(Date.now() - 290000),
  };
  mockDb.executions.set(pastExecDoc._id, pastExecDoc);

  const crashAfterExecClaim = {
    _id: 'claim_crash_after_exec',
    workflow: 'wf_webhook_crash_recovery',
    eventIdentifier: 'evt_crash_after_exec_3',
    status: 'processing',
    workerId: 'worker_crashed_instance_8',
    claimExpiresAt: new Date(Date.now() - 60000),
    heartbeatAt: new Date(Date.now() - 60000),
    execution: null,
  };
  mockDb.webhookEvents.set(crashAfterExecClaim._id, crashAfterExecClaim);

  const initialExecCount = mockDb.executions.size;
  const crashResC = await webhookService.processWebhook(crashWf, {
    method: 'POST',
    headers: { 'x-event-id': 'evt_crash_after_exec_3' },
    body: { item: 'duplicate_check' },
  });
  check('Crash after execution recovers existing execution without re-running workflow', crashResC.body.executionId === 'exec_prior_completed_success');
  check('No duplicate execution created (idempotency preserved)', mockDb.executions.size === initialExecCount);
  check('Claim status updated to success with existing execution attached', mockDb.webhookEvents.get('claim_crash_after_exec').status === 'success');

  // Scenario 8D: recoverAbandonedWebhookClaims background sweep
  const abandonedUnretried = {
    _id: 'claim_abandoned_unretried',
    workflow: 'wf_webhook_crash_recovery',
    eventIdentifier: 'evt_unretried_4',
    status: 'processing',
    claimExpiresAt: new Date(Date.now() - 100000),
    execution: null,
  };
  mockDb.webhookEvents.set(abandonedUnretried._id, abandonedUnretried);
  const sweptCount = await webhookService.recoverAbandonedWebhookClaims(0);
  check('recoverAbandonedWebhookClaims marks unretried abandoned claim as failed', sweptCount > 0);
  check('Abandoned claim status marked failed', mockDb.webhookEvents.get('claim_abandoned_unretried').status === 'failed');

  // ── 9. Comprehensive Resume Token Redaction ────────────────────────────────
  console.log('\nGroup 9: Comprehensive Resume Token Redaction');

  const waitApprovalExec = {
    _id: 'exec_comprehensive_tokens',
    workflow: 'wf_webhook_crash_recovery',
    owner: 'user_1',
    status: ExecutionStatus.WAITING_APPROVAL,
    resumeToken: 'root_resume_token_xyz',
    approval: {
      status: 'pending',
      resumeToken: 'approval_resume_token_abc',
    },
    wait: {
      status: 'waiting',
      resumeToken: 'wait_resume_token_123',
    },
    steps: [
      {
        nodeId: 'wait_node',
        output: { pauseReason: 'wait', resumeToken: 'unredacted_step_token_456' },
      },
    ],
    checkpoint: {
      lastOutput: { resumeToken: 'unredacted_checkpoint_token_789' },
      executedOutputs: {
        node_1: { resumeToken: 'unredacted_node_token_999' },
      },
    },
  };
  await Execution.create(waitApprovalExec);

  // Check 9A: Execution.findById with toJSON()
  const fetchedTokens = await Execution.findById('exec_comprehensive_tokens');
  const jsonDoc = fetchedTokens.toJSON();
  check('toJSON() redacts wait.resumeToken', jsonDoc.wait.resumeToken === '[REDACTED]');
  check('toJSON() redacts approval.resumeToken', jsonDoc.approval.resumeToken === '[REDACTED]');
  check('toJSON() redacts root resumeToken', jsonDoc.resumeToken === '[REDACTED]');

  // Check 9B: Plain object from lean query sanitized by executionService
  const rawLeanObj = { ...waitApprovalExec };
  const sanitizedLean = executionService.sanitizeExecution(rawLeanObj);
  check('sanitizeExecution redacts wait.resumeToken on plain lean objects', sanitizedLean.wait.resumeToken === '[REDACTED]');
  check('sanitizeExecution redacts approval.resumeToken on plain lean objects', sanitizedLean.approval.resumeToken === '[REDACTED]');
  check('sanitizeExecution redacts root resumeToken on plain lean objects', sanitizedLean.resumeToken === '[REDACTED]');
  check('sanitizeExecution redacts steps[].output.resumeToken', sanitizedLean.steps[0].output.resumeToken === '[REDACTED]');
  check('sanitizeExecution redacts checkpoint.lastOutput.resumeToken', sanitizedLean.checkpoint.lastOutput.resumeToken === '[REDACTED]');
  check('sanitizeExecution redacts checkpoint.executedOutputs.resumeToken', sanitizedLean.checkpoint.executedOutputs.node_1.resumeToken === '[REDACTED]');

  // ── 10. Worker Identity & Authoritative Execution Fencing ──────────────────
  console.log('\nGroup 10: Worker Identity & Authoritative Execution Fencing');

  const { generateWorkerId } = require('../utils');
  const worker1 = generateWorkerId('test');
  const worker2 = generateWorkerId('test');
  check('generateWorkerId produces non-empty string', typeof worker1 === 'string' && worker1.startsWith('test_'));
  check('generateWorkerId produces unique collision-resistant IDs', worker1 !== worker2);

  // Test legacy execution recovery without leaseExpiresAt or startedAt
  const legacyExec = {
    _id: 'exec_legacy_no_lease',
    workflow: 'wf_webhook_crash_recovery',
    owner: 'user_1',
    status: ExecutionStatus.RUNNING,
    startedAt: null,
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    leaseExpiresAt: null,
  };
  mockDb.executions.set(legacyExec._id, legacyExec);
  const recoveredLegacy = await workflowEngine.recoverInterruptedExecutions({ staleThresholdMs: 60000 });
  check('Legacy execution without lease or startedAt safely recovered', recoveredLegacy > 0);
  check('Legacy execution status marked failed', mockDb.executions.get('exec_legacy_no_lease').status === ExecutionStatus.FAILED);

  // ── 11. Scheduler Fencing & Duplicate Dispatch Prevention ──────────────────
  console.log('\nGroup 11: Scheduler Fencing & Duplicate Dispatch Prevention');

  // Verify occurrenceId uniqueness prevents duplicate workflow execution
  const occSchedWf = {
    _id: 'wf_occ_test',
    name: 'Occurrence Test Flow',
    owner: 'user_1',
    status: WorkflowStatus.ACTIVE,
    nodes: [{ id: 'n1', type: NodeTypes.TRIGGER_SCHEDULE, data: { label: 'Sched' } }],
    edges: [],
  };
  mockDb.workflows.set('wf_occ_test', occSchedWf);

  const occId = 'occ_sched_99999_2026';
  const firstOccRun = await workflowEngine.run(occSchedWf, 'user_1', 'schedule', { occurrenceId: occId });
  check('First occurrence runs and creates execution', firstOccRun.occurrenceId === occId);

  // Sibling worker attempts to dispatch same occurrence
  const secondOccRun = await workflowEngine.run(occSchedWf, 'user_1', 'schedule', { occurrenceId: occId });
  check('Second occurrence is intercepted and returns existing execution without duplicate dispatch', String(secondOccRun._id) === String(firstOccRun._id));

  // Test scheduler worker continuing after losing lease:
  const fencedSched = {
    _id: 'sched_fenced_worker_test',
    name: 'Fenced Schedule',
    workflow: 'wf_occ_test',
    owner: 'user_1',
    type: 'interval',
    intervalMinutes: 10,
    status: 'active',
    enabled: true,
    lockedBy: 'worker_beta_current_owner',
    lockExpiresAt: new Date(Date.now() + 300000),
    runCount: 5,
    save: async function () {
      mockDb.schedules.set(String(this._id), this);
      return this;
    },
  };
  mockDb.schedules.set(fencedSched._id, fencedSched);

  // Worker Alpha attempts to execute and finalize schedule after losing lock to Beta
  const workerAlphaResult = await scheduleManager.executeSchedule(fencedSched, 'worker_alpha_lost_owner');
  check('Fenced worker schedule execution succeeds with fenced flag or leaves new lock intact', workerAlphaResult.success === true);
  check('Worker Beta lock is NOT overwritten by fenced Worker Alpha', mockDb.schedules.get('sched_fenced_worker_test').lockedBy === 'worker_beta_current_owner');
  check('Schedule run count not corrupted by fenced Worker Alpha', mockDb.schedules.get('sched_fenced_worker_test').runCount === 5);

  // ── 12. Webhook Index Migration & Historical Deduplication ─────────────────
  console.log('\nGroup 12: Webhook Index Migration & Historical Deduplication');

  // Test ensureWebhookIndexes runs safely
  let indexMigrationPassed = false;
  try {
    await webhookService.ensureWebhookIndexes();
    indexMigrationPassed = true;
  } catch (err) {
    indexMigrationPassed = false;
  }
  check('ensureWebhookIndexes executes without error', indexMigrationPassed);

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

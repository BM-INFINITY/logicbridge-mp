const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const workflowEngine = require('./workflowEngine');
const { ExecutionStatus } = require('../constants');

// Coalescing registries for concurrent in-flight replay & retry requests
const activeReplays = new Map();
const activeRetries = new Map();

/**
 * Defensive sanitizer to ensure resume tokens (wait, approval, root, steps, checkpoint)
 * are never exposed in API payloads, lean queries, or serialization exports.
 */
function sanitizeExecution(exec) {
  if (!exec) return exec;
  if (Array.isArray(exec)) return exec.map(sanitizeExecution);

  let ret;
  if (typeof exec.toObject === 'function') {
    ret = exec.toObject();
  } else if (typeof exec.toJSON === 'function') {
    ret = exec.toJSON();
  } else {
    ret = { ...exec };
  }

  // Redact wait.resumeToken
  if (ret.wait && ret.wait.resumeToken) {
    ret.wait = { ...ret.wait, resumeToken: '[REDACTED]' };
  }
  // Redact approval.resumeToken
  if (ret.approval && ret.approval.resumeToken) {
    ret.approval = { ...ret.approval, resumeToken: '[REDACTED]' };
  }
  // Redact root resumeToken
  if (ret.resumeToken) {
    ret.resumeToken = '[REDACTED]';
  }
  // Redact in steps outputs
  if (Array.isArray(ret.steps)) {
    ret.steps = ret.steps.map((s) => {
      if (s?.output && s.output.resumeToken) {
        return {
          ...s,
          output: { ...s.output, resumeToken: '[REDACTED]' },
        };
      }
      return s;
    });
  }
  // Redact in checkpoint outputs
  if (ret.checkpoint) {
    const cp = { ...ret.checkpoint };
    if (cp.lastOutput && cp.lastOutput.resumeToken) {
      cp.lastOutput = { ...cp.lastOutput, resumeToken: '[REDACTED]' };
    }
    if (cp.executedOutputs && typeof cp.executedOutputs === 'object') {
      const sanitizedOutputs = {};
      for (const [k, v] of Object.entries(cp.executedOutputs)) {
        if (v && typeof v === 'object' && v.resumeToken) {
          sanitizedOutputs[k] = { ...v, resumeToken: '[REDACTED]' };
        } else {
          sanitizedOutputs[k] = v;
        }
      }
      cp.executedOutputs = sanitizedOutputs;
    }
    ret.checkpoint = cp;
  }

  return ret;
}

/**
 * Get all executions for a user (dashboard stats)
 */
async function getExecutionsByOwner(ownerId, limit = 50) {
  // First sweep any expired timeouts
  try {
    await workflowEngine.sweepTimeouts();
  } catch (err) {
    console.warn('[ExecutionService] Timeout sweep warning:', err.message);
  }

  const docs = await Execution.find({ owner: ownerId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .populate('workflow', 'name');
  return sanitizeExecution(docs);
}

/**
 * Get execution history for a specific workflow
 */
async function getExecutionsByWorkflow(workflowId, ownerId, limit = 50) {
  try {
    await workflowEngine.sweepTimeouts();
  } catch (err) {
    console.warn('[ExecutionService] Timeout sweep warning:', err.message);
  }

  const docs = await Execution.find({
    workflow: workflowId,
    owner: ownerId,
  })
    .sort({ startedAt: -1 })
    .limit(limit);
  return sanitizeExecution(docs);
}

/**
 * Get single execution detail
 */
async function getExecutionByIdAndOwner(executionId, ownerId) {
  const execution = await Execution.findOne({ _id: executionId, owner: ownerId })
    .populate('workflow', 'name');
  if (!execution) {
    const error = new Error('Execution not found');
    error.statusCode = 404;
    throw error;
  }
  return sanitizeExecution(execution);
}

/**
 * Replays a past workflow execution using identical input payload.
 * Coalesces concurrent in-flight requests without suppressing subsequent legitimate retries.
 */
async function replayExecution(executionId, ownerId) {
  const key = `replay_${executionId}_${ownerId}`;
  if (activeReplays.has(key)) {
    return await activeReplays.get(key);
  }

  const replayPromise = (async () => {
    const pastExecution = await getExecutionByIdAndOwner(executionId, ownerId);
    const workflow = await Workflow.findById(pastExecution.workflow);

    if (!workflow) {
      const error = new Error('Associated workflow not found for replay');
      error.statusCode = 404;
      throw error;
    }

    const initialInput = pastExecution.steps?.[0]?.input || null;
    return await workflowEngine.run(workflow, ownerId, 'replay', initialInput);
  })();

  activeReplays.set(key, replayPromise);
  try {
    return await replayPromise;
  } finally {
    activeReplays.delete(key);
  }
}

/**
 * Retries a failed or past workflow execution as a fresh retry run.
 * Distinct from visual/historical replay, uses trigger 'retry'.
 */
async function retryExecution(executionId, ownerId) {
  const key = `retry_${executionId}_${ownerId}`;
  if (activeRetries.has(key)) {
    return await activeRetries.get(key);
  }

  const retryPromise = (async () => {
    const pastExecution = await getExecutionByIdAndOwner(executionId, ownerId);
    const workflow = await Workflow.findById(pastExecution.workflow);

    if (!workflow) {
      const error = new Error('Associated workflow not found for retry');
      error.statusCode = 404;
      throw error;
    }

    const initialInput = pastExecution.steps?.[0]?.input || null;
    return await workflowEngine.run(workflow, ownerId, 'retry', initialInput);
  })();

  activeRetries.set(key, retryPromise);
  try {
    return await retryPromise;
  } finally {
    activeRetries.delete(key);
  }
}

/**
 * Get pending approvals accessible to the user
 */
async function getPendingApprovals(user) {
  // Auto-sweep expired timeouts
  try {
    await workflowEngine.sweepTimeouts();
  } catch (err) {
    console.warn('[ExecutionService] Timeout sweep warning:', err.message);
  }

  const userId = user?._id ? String(user._id) : null;
  const userEmail = user?.email;
  const userRole = user?.role || 'user';
  const isAdmin = userRole === 'admin';

  const query = {
    status: ExecutionStatus.WAITING_APPROVAL,
    'approval.status': 'pending',
  };

  const executions = await Execution.find(query)
    .sort({ startedAt: -1 })
    .populate('workflow', 'name');

  // Filter by user authorization
  return executions
    .filter((exec) => {
      if (isAdmin) return true;
      const allowed = exec.approval?.allowedApprovers || [];
      const role = exec.approval?.approverRole;
      if (role && (userRole === role || isAdmin)) return true;
      if (userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase())) return true;
      if (userId && allowed.includes(userId)) return true;
      if (allowed.length === 0 && !role && String(exec.owner) === userId) return true;
      return false;
    })
    .map(sanitizeExecution);
}

/**
 * Get approval detail by execution ID
 */
async function getApprovalById(executionId, user) {
  const execution = await Execution.findById(executionId).populate('workflow', 'name');
  if (!execution || !execution.approval) {
    const error = new Error('Approval request not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = user?._id ? String(user._id) : null;
  const userEmail = user?.email;
  const userRole = user?.role || 'user';
  const isAdmin = userRole === 'admin';
  const allowed = execution.approval.allowedApprovers || [];
  const role = execution.approval.approverRole;

  const isOwner = String(execution.owner) === userId;
  const isEmail = userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase());
  const isId = userId && allowed.includes(userId);
  const isRole = role && (userRole === role || isAdmin);
  const isUnrestricted = allowed.length === 0 && !role;

  let isAuthorized = false;
  if (isAdmin) {
    isAuthorized = true;
  } else if (role && allowed.length > 0) {
    isAuthorized = isRole || isEmail || isId;
  } else if (role) {
    isAuthorized = isRole;
  } else if (allowed.length > 0) {
    isAuthorized = isEmail || isId;
  } else {
    isAuthorized = isOwner;
  }

  if (!isAuthorized) {
    const error = new Error('Unauthorized to view this approval request');
    error.statusCode = 403;
    throw error;
  }

  return sanitizeExecution(execution);
}

/**
 * Submit decision for a pending approval
 */
async function decideApproval(executionId, decision, comments, user) {
  const updated = await workflowEngine.resume(executionId, { decision, comments }, user);
  return sanitizeExecution(updated);
}

/**
 * Resume a paused wait execution by external event resumeToken
 */
async function resumeByToken(resumeToken, payload = {}) {
  const execution = await Execution.findOne({ 'wait.resumeToken': resumeToken });
  if (!execution) {
    const error = new Error('Invalid resume token or execution not found');
    error.statusCode = 404;
    throw error;
  }

  if (execution.status !== ExecutionStatus.PAUSED || execution.wait?.status !== 'waiting') {
    const error = new Error('Execution is no longer in a waiting state');
    error.statusCode = 400;
    throw error;
  }

  if (execution.wait?.timeoutAt && new Date() > new Date(execution.wait.timeoutAt)) {
    const error = new Error('Wait timeout has expired');
    error.statusCode = 410;
    throw error;
  }

  return workflowEngine.resume(execution._id, {
    resumedBy: 'webhook_token',
    payload,
  });
}

/**
 * Cancels a paused or waiting execution
 */
async function cancelExecution(executionId, user) {
  const execution = await Execution.findById(executionId);
  if (!execution) {
    const error = new Error('Execution not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = user?._id ? String(user._id) : null;
  if (String(execution.owner) !== userId) {
    const error = new Error('Unauthorized to cancel this execution');
    error.statusCode = 403;
    throw error;
  }

  const terminalStatuses = [ExecutionStatus.SUCCESS, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED];
  if (terminalStatuses.includes(execution.status)) {
    const error = new Error(`Cannot cancel execution with terminal status "${execution.status}". Terminal states are immutable.`);
    error.statusCode = 400;
    throw error;
  }

  if (execution.status === ExecutionStatus.RUNNING) {
    const error = new Error('Cannot cancel execution with status "running". In-flight execution cancellation is not supported; cancellation is available for paused and waiting_approval executions.');
    error.statusCode = 400;
    throw error;
  }

  if (execution.status !== ExecutionStatus.PAUSED && execution.status !== ExecutionStatus.WAITING_APPROVAL) {
    const error = new Error(`Cannot cancel execution with status "${execution.status}"`);
    error.statusCode = 400;
    throw error;
  }

  execution.status = ExecutionStatus.CANCELLED;
  execution.finishedAt = new Date();
  execution.duration = execution.finishedAt.getTime() - execution.startedAt.getTime();
  execution.checkpoint = null;
  if (execution.approval) execution.approval.status = 'cancelled';
  if (execution.wait) execution.wait.status = 'cancelled';

  await execution.save();
  return sanitizeExecution(execution);
}

/**
 * Ensures safe partial unique indexes for execution resume tokens and occurrence IDs,
 * dropping legacy non-partial sparse unique indexes that collide on multiple nulls.
 * Safe, idempotent, and non-destructive.
 *
 * @param {import('mongodb').Db} [customDb]
 * @returns {Promise<{ dropped: string[], created: string[] }>}
 */
async function ensureExecutionIndexes(customDb = null) {
  const mongoose = require('mongoose');
  const db = customDb || (mongoose.connection && mongoose.connection.readyState === 1 ? mongoose.connection.db : null);
  if (!db) {
    return { dropped: [], created: [] };
  }

  const results = { dropped: [], created: [] };
  const executions = db.collection('executions');

  let existingIndexes = [];
  try {
    existingIndexes = await executions.indexes();
  } catch (err) {
    // If collection does not exist yet, it will be initialized on first write
    return results;
  }

  // 1. Check & drop obsolete 'approval.resumeToken_1' if it lacks partialFilterExpression
  const obsoleteApprovalIdx = existingIndexes.find(
    (idx) => idx.name === 'approval.resumeToken_1' || (idx.key && idx.key['approval.resumeToken'])
  );
  if (obsoleteApprovalIdx && !obsoleteApprovalIdx.partialFilterExpression) {
    try {
      console.log(`[ExecutionService] Dropping obsolete sparse index: ${obsoleteApprovalIdx.name}...`);
      await executions.dropIndex(obsoleteApprovalIdx.name);
      results.dropped.push(obsoleteApprovalIdx.name);
    } catch (dropErr) {
      console.warn(`[ExecutionService] Failed to drop obsolete index ${obsoleteApprovalIdx.name}:`, dropErr.message);
    }
  }

  // 2. Check & drop obsolete 'wait.resumeToken_1' if it lacks partialFilterExpression
  const obsoleteWaitIdx = existingIndexes.find(
    (idx) => idx.name === 'wait.resumeToken_1' || (idx.key && idx.key['wait.resumeToken'])
  );
  if (obsoleteWaitIdx && !obsoleteWaitIdx.partialFilterExpression) {
    try {
      console.log(`[ExecutionService] Dropping obsolete sparse index: ${obsoleteWaitIdx.name}...`);
      await executions.dropIndex(obsoleteWaitIdx.name);
      results.dropped.push(obsoleteWaitIdx.name);
    } catch (dropErr) {
      console.warn(`[ExecutionService] Failed to drop obsolete index ${obsoleteWaitIdx.name}:`, dropErr.message);
    }
  }

  // 3. Check & drop obsolete 'occurrenceId_1' if it lacks partialFilterExpression
  const obsoleteOccurrenceIdx = existingIndexes.find(
    (idx) => idx.name === 'occurrenceId_1' || (idx.key && idx.key['occurrenceId'])
  );
  if (obsoleteOccurrenceIdx && !obsoleteOccurrenceIdx.partialFilterExpression) {
    try {
      console.log(`[ExecutionService] Dropping obsolete sparse index: ${obsoleteOccurrenceIdx.name}...`);
      await executions.dropIndex(obsoleteOccurrenceIdx.name);
      results.dropped.push(obsoleteOccurrenceIdx.name);
    } catch (dropErr) {
      console.warn(`[ExecutionService] Failed to drop obsolete index ${obsoleteOccurrenceIdx.name}:`, dropErr.message);
    }
  }

  // 4. Verify no duplicate non-null string tokens exist before building unique index
  try {
    const dupApprovals = await executions
      .aggregate([
        { $match: { 'approval.resumeToken': { $type: 'string' } } },
        { $group: { _id: '$approval.resumeToken', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (dupApprovals.length > 0) {
      console.warn(`[ExecutionService] Detected ${dupApprovals.length} duplicate non-null approval resume tokens!`);
    }

    const dupWaits = await executions
      .aggregate([
        { $match: { 'wait.resumeToken': { $type: 'string' } } },
        { $group: { _id: '$wait.resumeToken', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (dupWaits.length > 0) {
      console.warn(`[ExecutionService] Detected ${dupWaits.length} duplicate non-null wait resume tokens!`);
    }
  } catch (aggErr) {
    console.warn(`[ExecutionService] Duplicate token check warning:`, aggErr.message);
  }

  // 5. Create replacement partial unique indexes
  try {
    await executions.createIndex(
      { 'approval.resumeToken': 1 },
      {
        name: 'idx_approval_resume_token_unique',
        unique: true,
        partialFilterExpression: { 'approval.resumeToken': { $type: 'string' } },
        background: true,
      }
    );
    results.created.push('idx_approval_resume_token_unique');

    await executions.createIndex(
      { 'wait.resumeToken': 1 },
      {
        name: 'idx_wait_resume_token_unique',
        unique: true,
        partialFilterExpression: { 'wait.resumeToken': { $type: 'string' } },
        background: true,
      }
    );
    results.created.push('idx_wait_resume_token_unique');

    await executions.createIndex(
      { occurrenceId: 1 },
      {
        name: 'idx_occurrence_id_unique',
        unique: true,
        partialFilterExpression: { occurrenceId: { $type: 'string' } },
        background: true,
      }
    );
    results.created.push('idx_occurrence_id_unique');

    console.log('✅ [ExecutionService] Execution resume token partial unique indexes verified and synchronized');
  } catch (createErr) {
    console.warn(`[ExecutionService] Index creation warning:`, createErr.message);
  }

  return results;
}

module.exports = {
  getExecutionsByOwner,
  getExecutionsByWorkflow,
  getExecutionByIdAndOwner,
  replayExecution,
  retryExecution,
  sanitizeExecution,
  getPendingApprovals,
  getApprovalById,
  decideApproval,
  resumeByToken,
  cancelExecution,
  ensureExecutionIndexes,
  sweepTimeouts: workflowEngine.sweepTimeouts,
};

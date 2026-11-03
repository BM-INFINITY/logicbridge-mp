const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const workflowEngine = require('./workflowEngine');
const { ExecutionStatus } = require('../constants');

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

  return Execution.find({ owner: ownerId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .populate('workflow', 'name');
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

  return Execution.find({
    workflow: workflowId,
    owner: ownerId,
  })
    .sort({ startedAt: -1 })
    .limit(limit);
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
  return execution;
}

/**
 * Replays a past workflow execution using identical input payload
 */
async function replayExecution(executionId, ownerId) {
  const pastExecution = await getExecutionByIdAndOwner(executionId, ownerId);
  const workflow = await Workflow.findById(pastExecution.workflow);

  if (!workflow) {
    const error = new Error('Associated workflow not found for replay');
    error.statusCode = 404;
    throw error;
  }

  const initialInput = pastExecution.steps?.[0]?.input || null;
  const newExecution = await workflowEngine.run(workflow, ownerId, 'replay', initialInput);

  return newExecution;
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
  const userRole = user?.role;

  const query = {
    status: ExecutionStatus.WAITING_APPROVAL,
    'approval.status': 'pending',
  };

  const executions = await Execution.find(query)
    .sort({ startedAt: -1 })
    .populate('workflow', 'name');

  // Filter by user authorization
  return executions.filter((exec) => {
    if (String(exec.owner) === userId) return true;
    const allowed = exec.approval?.allowedApprovers || [];
    const role = exec.approval?.approverRole;
    if (allowed.length === 0 && !role) return true; // Unrestricted
    if (userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase())) return true;
    if (userId && allowed.includes(userId)) return true;
    if (role && userRole === role) return true;
    return false;
  });
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
  const userRole = user?.role;
  const allowed = execution.approval.allowedApprovers || [];
  const role = execution.approval.approverRole;

  const isOwner = String(execution.owner) === userId;
  const isEmail = userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase());
  const isId = userId && allowed.includes(userId);
  const isRole = role && userRole === role;
  const isUnrestricted = allowed.length === 0 && !role;

  if (!isOwner && !isEmail && !isId && !isRole && !isUnrestricted) {
    const error = new Error('Unauthorized to view this approval request');
    error.statusCode = 403;
    throw error;
  }

  return execution;
}

/**
 * Submit decision for a pending approval
 */
async function decideApproval(executionId, decision, comments, user) {
  return workflowEngine.resume(executionId, { decision, comments }, user);
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
  return execution;
}

module.exports = {
  getExecutionsByOwner,
  getExecutionsByWorkflow,
  getExecutionByIdAndOwner,
  replayExecution,
  getPendingApprovals,
  getApprovalById,
  decideApproval,
  resumeByToken,
  cancelExecution,
  sweepTimeouts: workflowEngine.sweepTimeouts,
};

const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const workflowEngine = require('./workflowEngine');

/**
 * Get all executions for a user (dashboard stats)
 */
async function getExecutionsByOwner(ownerId, limit = 20) {
  return Execution.find({ owner: ownerId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .populate('workflow', 'name');
}

/**
 * Get execution history for a specific workflow
 */
async function getExecutionsByWorkflow(workflowId, ownerId, limit = 50) {
  return Execution.find({
    workflow: workflowId,
    owner: ownerId,
  }).sort({ startedAt: -1 }).limit(limit);
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

module.exports = {
  getExecutionsByOwner,
  getExecutionsByWorkflow,
  getExecutionByIdAndOwner,
  replayExecution,
};

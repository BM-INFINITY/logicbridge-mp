const Execution = require('../models/Execution');

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

module.exports = {
  getExecutionsByOwner,
  getExecutionsByWorkflow,
  getExecutionByIdAndOwner,
};

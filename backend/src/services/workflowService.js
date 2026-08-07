const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const { scheduleWorkflow, unscheduleWorkflow } = require('./scheduler');
const { NodeTypes, WorkflowStatus } = require('../constants');

/**
 * Fetch all workflows owned by a user
 */
async function getWorkflowsByOwner(ownerId) {
  return Workflow.find({ owner: ownerId }).sort({ updatedAt: -1 });
}

/**
 * Create a new workflow for a user
 */
async function createWorkflow({ name, description, nodes, edges, ownerId }) {
  return Workflow.create({
    name: name || 'Untitled Workflow',
    description: description || '',
    owner: ownerId,
    nodes: nodes || [],
    edges: edges || [],
  });
}

/**
 * Fetch single workflow by ID and owner
 */
async function getWorkflowByIdAndOwner(workflowId, ownerId) {
  const workflow = await Workflow.findOne({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }
  return workflow;
}

/**
 * Update workflow and handle schedule updates
 */
async function updateWorkflow(workflowId, ownerId, updateBody) {
  const body = { ...updateBody };
  if (Array.isArray(body.nodes)) {
    body.nodes = body.nodes.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } }));
  }

  const workflow = await Workflow.findOneAndUpdate(
    { _id: workflowId, owner: ownerId },
    body,
    { new: true }
  );

  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }

  // Auto-schedule if active and contains trigger-schedule
  const hasSchedule = workflow.nodes?.some(n => n.type === NodeTypes.TRIGGER_SCHEDULE);
  if (hasSchedule && workflow.status === WorkflowStatus.ACTIVE) {
    scheduleWorkflow(workflow);
  } else {
    unscheduleWorkflow(workflow._id);
  }

  return workflow;
}

/**
 * Delete workflow and associated execution records
 */
async function deleteWorkflowAndExecutions(workflowId, ownerId) {
  const workflow = await Workflow.findOneAndDelete({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }
  await Execution.deleteMany({ workflow: workflowId });
  return { message: 'Workflow deleted' };
}

module.exports = {
  getWorkflowsByOwner,
  createWorkflow,
  getWorkflowByIdAndOwner,
  updateWorkflow,
  deleteWorkflowAndExecutions,
};

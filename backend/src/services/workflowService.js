const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const { scheduleWorkflow, unscheduleWorkflow } = require('./scheduler');
const { NodeTypes, WorkflowStatus } = require('../constants');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');

/**
 * Fetch all workflows owned by a user
 */
async function getWorkflowsByOwner(ownerId) {
  return Workflow.find({ owner: ownerId }).sort({ updatedAt: -1 });
}

/**
 * Create a new workflow for a user
 */
async function createWorkflow({ name, description, nodes, edges, ownerId, status, label, changeReason }) {
  const initialSnapshot = {
    version: 1,
    label: label || 'Initial',
    changeReason: changeReason || 'Initial workflow creation',
    name: name || 'Untitled Workflow',
    description: description || '',
    nodes: nodes || [],
    edges: edges || [],
    createdAt: new Date(),
    createdBy: String(ownerId),
  };

  return Workflow.create({
    name: name || 'Untitled Workflow',
    description: description || '',
    status: status || WorkflowStatus.DRAFT,
    owner: ownerId,
    version: 1,
    versionHistory: [initialSnapshot],
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
 * Update workflow, increment version, and record snapshot in versionHistory
 */
async function updateWorkflow(workflowId, ownerId, updateBody, options = {}) {
  const existing = await Workflow.findOne({ _id: workflowId, owner: ownerId });
  if (!existing) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }

  const body = { ...updateBody };
  if (Array.isArray(body.nodes)) {
    body.nodes = body.nodes.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } }));
  }

  const hasStructuralChanges = body.nodes || body.edges || body.name;

  if (hasStructuralChanges) {
    const currentVersion = existing.version || 1;
    const nextVersion = currentVersion + 1;

    // Snapshot current state before updating
    const snapshot = {
      version: currentVersion,
      label: options.label || body.label || `Version ${currentVersion}`,
      changeReason: options.changeReason || body.changeReason || 'Workflow updated',
      name: existing.name,
      description: existing.description,
      nodes: existing.nodes,
      edges: existing.edges,
      schedule: existing.schedule,
      createdAt: new Date(),
      createdBy: String(ownerId),
    };

    body.version = nextVersion;
    body.$push = { versionHistory: snapshot };
  }

  const workflow = await Workflow.findOneAndUpdate(
    { _id: workflowId, owner: ownerId },
    body,
    { new: true }
  );

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
 * Reverts a workflow to a target version snapshot safely
 * Re-uses WorkflowImportValidator to validate snapshot before restoring
 */
async function revertToVersion(workflowId, ownerId, targetVersion) {
  const workflow = await Workflow.findOne({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }

  const snapshot = workflow.versionHistory.find((v) => Number(v.version) === Number(targetVersion));
  if (!snapshot) {
    const error = new Error(`Version ${targetVersion} snapshot not found in version history`);
    error.statusCode = 404;
    throw error;
  }

  // Reuse WorkflowImportValidator to validate snapshot payload
  const snapshotPayload = {
    schemaVersion: '1.0.0',
    workflow: {
      name: snapshot.name,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    },
  };
  const validation = WorkflowImportValidator.validate(snapshotPayload);
  if (!validation.valid) {
    const error = new Error(`Target version ${targetVersion} validation failed: ${validation.errors.join('; ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Reverting ALWAYS creates a snapshot of the current state before restoring
  return updateWorkflow(
    workflowId,
    ownerId,
    {
      name: snapshot.name,
      description: snapshot.description,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      schedule: snapshot.schedule,
    },
    {
      label: `Reverted to v${targetVersion}`,
      changeReason: `Reverted workflow state from v${workflow.version} to v${targetVersion}`,
    }
  );
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
  revertToVersion,
  deleteWorkflowAndExecutions,
};

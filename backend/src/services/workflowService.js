const Workflow = require('../models/Workflow');
const WorkflowSecret = require('../models/WorkflowSecret');
const Execution = require('../models/Execution');
const { scheduleWorkflow, unscheduleWorkflow } = require('./scheduler');
const { NodeTypes, WorkflowStatus } = require('../constants');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');
const CredentialService = require('./CredentialService');
const { validateVariable, validateSecret } = require('../validators/workflowVariableValidator');

/**
 * Fetch all workflows owned by a user
 */
async function getWorkflowsByOwner(ownerId) {
  return Workflow.find({ owner: ownerId }).sort({ updatedAt: -1 });
}

/**
 * Create a new workflow for a user
 */
async function createWorkflow({ name, description, nodes, edges, variables, ownerId, status, label, changeReason }) {
  const initialSnapshot = {
    version: 1,
    label: label || 'Initial',
    changeReason: changeReason || 'Initial workflow creation',
    name: name || 'Untitled Workflow',
    description: description || '',
    nodes: nodes || [],
    edges: edges || [],
    variables: variables || [],
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
    variables: variables || [],
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

  const hasStructuralChanges = body.nodes || body.edges || body.name || body.variables;

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
      variables: existing.variables || [],
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
 * Delete workflow and associated execution records and secrets
 */
async function deleteWorkflowAndExecutions(workflowId, ownerId) {
  const workflow = await Workflow.findOneAndDelete({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }
  await Execution.deleteMany({ workflow: workflowId });
  await WorkflowSecret.deleteMany({ workflowId });
  return { message: 'Workflow deleted' };
}

/**
 * Get all variables for a workflow
 */
async function getVariables(workflowId, ownerId) {
  const workflow = await getWorkflowByIdAndOwner(workflowId, ownerId);
  return workflow.variables || [];
}

/**
 * Create a new variable in a workflow
 */
async function createVariable(workflowId, ownerId, payload) {
  const validation = validateVariable(payload);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const workflow = await getWorkflowByIdAndOwner(workflowId, ownerId);
  const existing = (workflow.variables || []).find((v) => v.name === validation.sanitized.name);
  if (existing) {
    const err = new Error(`Variable with name "${validation.sanitized.name}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  workflow.variables.push(validation.sanitized);
  await workflow.save();
  return workflow.variables[workflow.variables.length - 1];
}

/**
 * Update an existing variable in a workflow
 */
async function updateVariable(workflowId, ownerId, varId, payload) {
  const validation = validateVariable(payload);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const workflow = await getWorkflowByIdAndOwner(workflowId, ownerId);
  const varItem = workflow.variables.id(varId);
  if (!varItem) {
    const err = new Error('Variable not found');
    err.statusCode = 404;
    throw err;
  }

  const nameClash = workflow.variables.find(
    (v) => v.name === validation.sanitized.name && String(v._id) !== String(varId)
  );
  if (nameClash) {
    const err = new Error(`Variable with name "${validation.sanitized.name}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  varItem.name = validation.sanitized.name;
  varItem.type = validation.sanitized.type;
  varItem.value = validation.sanitized.value;
  varItem.description = validation.sanitized.description;

  await workflow.save();
  return varItem;
}

/**
 * Delete a variable from a workflow
 */
async function deleteVariable(workflowId, ownerId, varId) {
  const workflow = await getWorkflowByIdAndOwner(workflowId, ownerId);
  const varItem = workflow.variables.id(varId);
  if (!varItem) {
    const err = new Error('Variable not found');
    err.statusCode = 404;
    throw err;
  }

  workflow.variables.pull(varId);
  await workflow.save();
  return { message: 'Variable deleted', varId };
}

/**
 * Get secret metadata for a workflow (never returns encryptedValue or plaintext value)
 */
async function getSecrets(workflowId, ownerId) {
  await getWorkflowByIdAndOwner(workflowId, ownerId);
  return WorkflowSecret.find({ workflowId, ownerId })
    .select('_id workflowId name description createdAt updatedAt')
    .sort({ name: 1 });
}

/**
 * Create an encrypted secret for a workflow
 */
async function createSecret(workflowId, ownerId, payload) {
  await getWorkflowByIdAndOwner(workflowId, ownerId);
  const validation = validateSecret(payload, false);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const existing = await WorkflowSecret.findOne({ workflowId, name: validation.sanitized.name });
  if (existing) {
    const err = new Error(`Secret with name "${validation.sanitized.name}" already exists in this workflow`);
    err.statusCode = 400;
    throw err;
  }

  const encryptedValue = CredentialService.encrypt(validation.sanitized.value);
  const doc = await WorkflowSecret.create({
    workflowId,
    ownerId,
    name: validation.sanitized.name,
    encryptedValue,
    description: validation.sanitized.description,
  });

  return {
    _id: doc._id,
    workflowId: doc.workflowId,
    name: doc.name,
    description: doc.description,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Update secret metadata or value (re-encrypts on value update)
 */
async function updateSecret(workflowId, ownerId, secretId, payload) {
  await getWorkflowByIdAndOwner(workflowId, ownerId);
  const validation = validateSecret(payload, true);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const secret = await WorkflowSecret.findOne({ _id: secretId, workflowId, ownerId });
  if (!secret) {
    const err = new Error('Secret not found');
    err.statusCode = 404;
    throw err;
  }

  if (validation.sanitized.name && validation.sanitized.name !== secret.name) {
    const nameClash = await WorkflowSecret.findOne({
      workflowId,
      name: validation.sanitized.name,
      _id: { $ne: secretId },
    });
    if (nameClash) {
      const err = new Error(`Secret with name "${validation.sanitized.name}" already exists in this workflow`);
      err.statusCode = 400;
      throw err;
    }
    secret.name = validation.sanitized.name;
  }

  if (validation.sanitized.value !== undefined) {
    secret.encryptedValue = CredentialService.encrypt(validation.sanitized.value);
  }

  if (payload.description !== undefined) {
    secret.description = validation.sanitized.description;
  }

  await secret.save();

  return {
    _id: secret._id,
    workflowId: secret.workflowId,
    name: secret.name,
    description: secret.description,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  };
}

/**
 * Delete a secret from a workflow
 */
async function deleteSecret(workflowId, ownerId, secretId) {
  await getWorkflowByIdAndOwner(workflowId, ownerId);
  const deleted = await WorkflowSecret.findOneAndDelete({ _id: secretId, workflowId, ownerId });
  if (!deleted) {
    const err = new Error('Secret not found');
    err.statusCode = 404;
    throw err;
  }
  return { message: 'Secret deleted', secretId };
}

module.exports = {
  getWorkflowsByOwner,
  createWorkflow,
  getWorkflowByIdAndOwner,
  updateWorkflow,
  revertToVersion,
  deleteWorkflowAndExecutions,
  getVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
};

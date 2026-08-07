const { NodeTypes, BranchTypes } = require('../constants');

/**
 * Validation rules for workflows
 */
function validateCreateWorkflow(body) {
  const { name } = body || {};
  if (name !== undefined && typeof name !== 'string') {
    return { valid: false, error: 'Workflow name must be a string' };
  }
  return { valid: true };
}

function validateUpdateWorkflow(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid update payload' };
  }
  return { valid: true };
}

function validateGenerateWorkflow(body) {
  const { prompt } = body || {};
  if (!prompt || !prompt.trim()) {
    return { valid: false, error: 'Prompt is required' };
  }
  return { valid: true };
}

/**
 * Validates condition nodes in a workflow graph prior to execution
 * Returns non-blocking warnings if True or False branches are missing
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {Array<string>} - Warning messages list
 */
function validateConditionBranches(nodes = [], edges = []) {
  const warnings = [];
  const conditionNodes = nodes.filter((n) => n.type === NodeTypes.LOGIC_CONDITION);

  for (const condNode of conditionNodes) {
    const nodeName = condNode.data?.label || condNode.id;
    const outgoingEdges = edges.filter((e) => e.source === condNode.id);

    const hasTrueBranch = outgoingEdges.some((e) => e.sourceHandle === BranchTypes.TRUE || !e.sourceHandle);
    const hasFalseBranch = outgoingEdges.some((e) => e.sourceHandle === BranchTypes.FALSE);

    if (!hasTrueBranch) {
      warnings.push(`Condition node "${nodeName}" is missing a True branch connection`);
    }
    if (!hasFalseBranch) {
      warnings.push(`Condition node "${nodeName}" is missing a False branch connection`);
    }
  }

  return warnings;
}

module.exports = {
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateGenerateWorkflow,
  validateConditionBranches,
};

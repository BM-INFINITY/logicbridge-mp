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

module.exports = {
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateGenerateWorkflow,
};

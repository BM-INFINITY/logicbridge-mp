const { workflowService, workflowEngine, aiGenerator } = require('../services');
const { workflowValidator } = require('../validators');
const { success, error } = require('../utils/ResponseHelper');

/**
 * Get all workflows for user
 * GET /api/workflows
 */
const getWorkflows = async (req, res, next) => {
  try {
    const workflows = await workflowService.getWorkflowsByOwner(req.user._id);
    return success(res, workflows);
  } catch (err) {
    return next(err);
  }
};

/**
 * AI generate workflow structure
 * POST /api/workflows/generate
 */
const generateWorkflow = async (req, res, next) => {
  try {
    const validation = workflowValidator.validateGenerateWorkflow(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const { prompt } = req.body;
    const generated = await aiGenerator.generate(prompt);
    return success(res, generated);
  } catch (err) {
    return next(err);
  }
};

/**
 * Create new workflow
 * POST /api/workflows
 */
const createWorkflow = async (req, res, next) => {
  try {
    const validation = workflowValidator.validateCreateWorkflow(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const workflow = await workflowService.createWorkflow({
      ...req.body,
      ownerId: req.user._id,
    });
    return success(res, workflow, 201);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get single workflow by ID
 * GET /api/workflows/:id
 */
const getWorkflowById = async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflowByIdAndOwner(req.params.id, req.user._id);
    return success(res, workflow);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Update workflow
 * PUT /api/workflows/:id
 */
const updateWorkflow = async (req, res, next) => {
  try {
    const validation = workflowValidator.validateUpdateWorkflow(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const workflow = await workflowService.updateWorkflow(req.params.id, req.user._id, req.body);
    return success(res, workflow);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Delete workflow
 * DELETE /api/workflows/:id
 */
const deleteWorkflow = async (req, res, next) => {
  try {
    const result = await workflowService.deleteWorkflowAndExecutions(req.params.id, req.user._id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Run workflow manually
 * POST /api/workflows/:id/run
 */
const runWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflowByIdAndOwner(req.params.id, req.user._id);
    const execution = await workflowEngine.run(workflow, req.user._id, 'manual');
    return success(res, execution);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

module.exports = {
  getWorkflows,
  generateWorkflow,
  createWorkflow,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
};

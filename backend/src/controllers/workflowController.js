const { workflowService, workflowEngine, aiGenerator, WorkflowSerializer } = require('../services');
const { workflowValidator } = require('../validators');
const { success, error } = require('../utils/ResponseHelper');
const { WebhookPayload } = require('../utils');
const Workflow = require('../models/Workflow');

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

/**
 * Trigger workflow via incoming Webhook POST
 * POST /api/workflows/:id/webhook
 */
const handleWebhook = async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return error(res, 'Workflow not found', 404);
    }

    const webhookPayload = WebhookPayload.fromRequest(req);
    const execution = await workflowEngine.run(workflow, workflow.owner, 'webhook', webhookPayload);
    return success(res, {
      message: 'Webhook received and workflow executed successfully',
      executionId: execution._id,
      status: execution.status,
      duration: execution.duration,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Export workflow as serialized JSON package
 * GET /api/workflows/:id/export
 */
const exportWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflowByIdAndOwner(req.params.id, req.user._id);
    const serialized = WorkflowSerializer.serialize(workflow, { exportedBy: req.user?.email || 'user' });
    return success(res, serialized);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Import workflow from serialized JSON package
 * POST /api/workflows/import
 */
const importWorkflow = async (req, res, next) => {
  try {
    const deserialized = WorkflowSerializer.deserialize(req.body);
    const workflow = await workflowService.createWorkflow({
      ...deserialized,
      ownerId: req.user._id,
    });
    return success(res, workflow, 201);
  } catch (err) {
    return error(res, err.message, 400);
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
  handleWebhook,
  exportWorkflow,
  importWorkflow,
};

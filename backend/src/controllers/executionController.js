const { executionService } = require('../services');
const { success, error } = require('../utils/ResponseHelper');

/**
 * Get workflow execution history
 * GET /api/executions/:workflowId
 */
const getWorkflowExecutions = async (req, res, next) => {
  try {
    const executions = await executionService.getExecutionsByWorkflow(req.params.workflowId, req.user._id);
    return success(res, executions);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get single execution detail
 * GET /api/executions/detail/:id
 */
const getExecutionDetail = async (req, res, next) => {
  try {
    const execution = await executionService.getExecutionByIdAndOwner(req.params.id, req.user._id);
    return success(res, execution);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Get all executions for user (dashboard stats)
 * GET /api/executions
 */
const getExecutions = async (req, res, next) => {
  try {
    const executions = await executionService.getExecutionsByOwner(req.user._id);
    return success(res, executions);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getWorkflowExecutions,
  getExecutionDetail,
  getExecutions,
};

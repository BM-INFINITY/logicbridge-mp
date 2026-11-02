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

/**
 * Replay past execution
 * POST /api/executions/:id/replay
 */
const replayExecution = async (req, res, next) => {
  try {
    const replayed = await executionService.replayExecution(req.params.id, req.user._id);
    return success(res, replayed, 201);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Get pending approvals for authenticated user
 * GET /api/executions/approvals
 */
const getPendingApprovals = async (req, res, next) => {
  try {
    const approvals = await executionService.getPendingApprovals(req.user);
    return success(res, approvals);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get single approval detail
 * GET /api/executions/approvals/:id
 */
const getApprovalDetail = async (req, res, next) => {
  try {
    const approval = await executionService.getApprovalById(req.params.id, req.user);
    return success(res, approval);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Submit approval decision
 * POST /api/executions/approvals/:id/decide
 */
const decideApproval = async (req, res, next) => {
  try {
    const { decision, comments } = req.body || {};
    const updated = await executionService.decideApproval(req.params.id, decision, comments, req.user);
    return success(res, updated);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Resume paused wait execution by external event resumeToken
 * POST /api/executions/resume/:resumeToken
 */
const resumeByToken = async (req, res, next) => {
  try {
    const resumed = await executionService.resumeByToken(req.params.resumeToken, req.body || {});
    return success(res, {
      message: 'Execution resumed successfully',
      executionId: resumed._id,
      status: resumed.status,
    });
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Cancel a waiting or paused execution
 * POST /api/executions/:id/cancel
 */
const cancelExecution = async (req, res, next) => {
  try {
    const cancelled = await executionService.cancelExecution(req.params.id, req.user);
    return success(res, cancelled);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Manually trigger timeout sweep
 * POST /api/executions/sweep
 */
const sweepTimeouts = async (req, res, next) => {
  try {
    const swept = await executionService.sweepTimeouts();
    return success(res, { sweptCount: swept.length, swept });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getWorkflowExecutions,
  getExecutionDetail,
  getExecutions,
  replayExecution,
  getPendingApprovals,
  getApprovalDetail,
  decideApproval,
  resumeByToken,
  cancelExecution,
  sweepTimeouts,
};

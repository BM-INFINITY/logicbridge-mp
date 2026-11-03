const Workflow = require('../models/Workflow');
const { webhookService } = require('../services');
const { success, error } = require('../utils/ResponseHelper');
const { NodeTypes } = require('../constants');

/**
 * Public inbound webhook receiver
 * Supports both :endpointId and workflow _id
 * ALL /api/webhooks/inbound/:endpointId
 */
const handleInboundWebhook = async (req, res, next) => {
  try {
    const { endpointId } = req.params;

    // Search workflow by ID or by node endpointId
    let workflow = null;
    if (endpointId.match(/^[0-9a-fA-F]{24}$/)) {
      workflow = await Workflow.findById(endpointId);
    }

    if (!workflow) {
      workflow = await Workflow.findOne({
        'nodes.data.endpointId': endpointId,
      });
    }

    if (!workflow) {
      return error(res, `Webhook endpoint "${endpointId}" not found`, 404);
    }

    const result = await webhookService.processWebhook(workflow, req, req.rawBody);
    if (result.headers) {
      res.set(result.headers);
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
};

/**
 * Get webhook event history for a workflow (protected)
 * GET /api/webhooks/workflow/:workflowId
 */
const getEvents = async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const history = await webhookService.getEventsByWorkflow(workflowId, req.user._id, req.query);
    return success(res, history);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Get detail for a single webhook event (protected)
 * GET /api/webhooks/events/:id
 */
const getEventDetail = async (req, res, next) => {
  try {
    const event = await webhookService.getEventDetail(req.params.id, req.user._id);
    return success(res, event);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Replay historical webhook event (protected)
 * POST /api/webhooks/events/:id/replay
 */
const replayEvent = async (req, res, next) => {
  try {
    const result = await webhookService.replayEvent(req.params.id, req.user._id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Toggle enable/disable for a workflow's webhook endpoint (protected)
 * POST /api/webhooks/workflow/:workflowId/toggle
 */
const toggleEndpoint = async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const workflow = await Workflow.findOne({ _id: workflowId, owner: req.user._id });
    if (!workflow) {
      return error(res, 'Workflow not found', 404);
    }

    const nodeIndex = workflow.nodes?.findIndex((n) => n.type === NodeTypes.TRIGGER_WEBHOOK);
    if (nodeIndex === -1) {
      return error(res, 'Workflow does not contain a Webhook Trigger node', 400);
    }

    const node = workflow.nodes[nodeIndex];
    const currentEnabled = node.data?.enabled !== false;
    node.data = {
      ...node.data,
      enabled: !currentEnabled,
    };

    workflow.markModified('nodes');
    await workflow.save();

    return success(res, {
      message: `Webhook endpoint ${!currentEnabled ? 'enabled' : 'disabled'}`,
      enabled: !currentEnabled,
      endpointId: node.data.endpointId || `wh_${workflow._id}`,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  handleInboundWebhook,
  getEvents,
  getEventDetail,
  replayEvent,
  toggleEndpoint,
};


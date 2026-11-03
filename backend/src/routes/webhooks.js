const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// Public inbound webhook endpoint: accepts POST, GET, PUT, PATCH, DELETE
router.all('/inbound/:endpointId', webhookController.handleInboundWebhook);

// Protected management routes
router.get('/workflow/:workflowId', protect, webhookController.getEvents);
router.post('/workflow/:workflowId/toggle', protect, webhookController.toggleEndpoint);
router.get('/events/:id', protect, webhookController.getEventDetail);
router.post('/events/:id/replay', protect, webhookController.replayEvent);

module.exports = router;


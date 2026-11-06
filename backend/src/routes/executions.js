const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { executionController } = require('../controllers');

const router = express.Router();

// GET /api/executions — get all executions for user (dashboard stats)
router.get('/', protect, executionController.getExecutions);

// Approvals management
// GET /api/executions/approvals — list pending approvals for user
router.get('/approvals', protect, executionController.getPendingApprovals);

// GET /api/executions/approvals/:id — get approval request details
router.get('/approvals/:id', protect, executionController.getApprovalDetail);

// POST /api/executions/approvals/:id/decide — submit approval decision
router.post('/approvals/:id/decide', protect, executionController.decideApproval);

// POST /api/executions/resume/:resumeToken — external resume webhook/event (token authorized)
router.post('/resume/:resumeToken', executionController.resumeByToken);

// POST /api/executions/sweep — sweep expired timers and approvals
router.post('/sweep', protect, executionController.sweepTimeouts);

// GET /api/executions/detail/:id — get single execution detail
router.get('/detail/:id', protect, executionController.getExecutionDetail);

// POST /api/executions/:id/replay — replay a past execution
router.post('/:id/replay', protect, executionController.replayExecution);

// POST /api/executions/:id/retry — retry a past execution (fresh retry run)
router.post('/:id/retry', protect, executionController.retryExecution);

// POST /api/executions/:id/cancel — cancel a waiting or paused execution
router.post('/:id/cancel', protect, executionController.cancelExecution);

// GET /api/executions/:workflowId — get execution history for a workflow
router.get('/:workflowId', protect, executionController.getWorkflowExecutions);

module.exports = router;

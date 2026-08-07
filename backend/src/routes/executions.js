const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { executionController } = require('../controllers');

const router = express.Router();

// GET /api/executions — get all executions for user (dashboard stats)
router.get('/', protect, executionController.getExecutions);

// GET /api/executions/detail/:id — get single execution detail
router.get('/detail/:id', protect, executionController.getExecutionDetail);

// GET /api/executions/:workflowId — get execution history for a workflow
router.get('/:workflowId', protect, executionController.getWorkflowExecutions);

module.exports = router;

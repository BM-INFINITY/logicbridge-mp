const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { workflowController } = require('../controllers');

const router = express.Router();

// GET /api/workflows — list all user's workflows
router.get('/', protect, workflowController.getWorkflows);

// POST /api/workflows/generate — AI generate (MUST be before /:id routes)
router.post('/generate', protect, workflowController.generateWorkflow);

// POST /api/workflows/import — Import serialized workflow package (MUST be before /:id routes)
router.post('/import', protect, workflowController.importWorkflow);

// POST /api/workflows — create workflow
router.post('/', protect, workflowController.createWorkflow);

// GET /api/workflows/:id — get workflow by ID
router.get('/:id', protect, workflowController.getWorkflowById);

// GET /api/workflows/:id/export — export serialized workflow package
router.get('/:id/export', protect, workflowController.exportWorkflow);

// PUT /api/workflows/:id — update workflow
router.put('/:id', protect, workflowController.updateWorkflow);

// DELETE /api/workflows/:id — delete workflow
router.delete('/:id', protect, workflowController.deleteWorkflow);

// POST /api/workflows/:id/run — execute workflow manually
router.post('/:id/run', protect, workflowController.runWorkflow);

// POST /api/workflows/:id/webhook — public webhook trigger endpoint
router.post('/:id/webhook', workflowController.handleWebhook);
router.get('/:id/webhook', workflowController.handleWebhook);

module.exports = router;

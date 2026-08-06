const express = require('express');
const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const { protect } = require('../middleware/authMiddleware');
const workflowEngine = require('../services/workflowEngine');
const aiGenerator = require('../services/aiGenerator');
const { scheduleWorkflow, unscheduleWorkflow } = require('../services/scheduler');

const router = express.Router();

// GET /api/workflows — list all user's workflows
router.get('/', protect, async (req, res) => {
  try {
    const workflows = await Workflow.find({ owner: req.user._id }).sort({ updatedAt: -1 });
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workflows/generate — AI generate (MUST be before /:id routes)
router.post('/generate', protect, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });
    const { name, description, nodes, edges } = await aiGenerator.generate(prompt);
    res.json({ name, description, nodes, edges });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workflows — create workflow
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const workflow = await Workflow.create({
      name: name || 'Untitled Workflow',
      description: description || '',
      owner: req.user._id,
      nodes: nodes || [],
      edges: edges || [],
    });
    res.status(201).json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/workflows/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, owner: req.user._id });
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/workflows/:id — update workflow
router.put('/:id', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (Array.isArray(body.nodes)) {
      body.nodes = body.nodes.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } }));
    }
    const workflow = await Workflow.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      body,
      { new: true }
    );
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    // Auto-schedule if it has a schedule trigger
    const hasSchedule = workflow.nodes?.some(n => n.type === 'trigger-schedule');
    if (hasSchedule && workflow.status === 'active') scheduleWorkflow(workflow);
    else unscheduleWorkflow(workflow._id);
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const workflow = await Workflow.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    await Execution.deleteMany({ workflow: req.params.id });
    res.json({ message: 'Workflow deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workflows/:id/run — execute workflow manually
router.post('/:id/run', protect, async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, owner: req.user._id });
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });

    const execution = await workflowEngine.run(workflow, req.user._id, 'manual');
    res.json(execution);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// (generate route moved to top of file)

module.exports = router;

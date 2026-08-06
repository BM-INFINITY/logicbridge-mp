const express = require('express');
const Execution = require('../models/Execution');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/executions/:workflowId — get execution history for a workflow
router.get('/:workflowId', protect, async (req, res) => {
  try {
    const executions = await Execution.find({
      workflow: req.params.workflowId,
      owner: req.user._id,
    }).sort({ startedAt: -1 }).limit(50);
    res.json(executions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/executions/detail/:id — get single execution detail
router.get('/detail/:id', protect, async (req, res) => {
  try {
    const execution = await Execution.findOne({ _id: req.params.id, owner: req.user._id })
      .populate('workflow', 'name');
    if (!execution) return res.status(404).json({ message: 'Execution not found' });
    res.json(execution);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/executions — get all executions for user (dashboard stats)
router.get('/', protect, async (req, res) => {
  try {
    const executions = await Execution.find({ owner: req.user._id })
      .sort({ startedAt: -1 })
      .limit(20)
      .populate('workflow', 'name');
    res.json(executions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

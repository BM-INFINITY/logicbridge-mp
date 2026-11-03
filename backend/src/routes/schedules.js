const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const scheduleController = require('../controllers/scheduleController');

const router = express.Router();

// POST /api/schedules/preview — preview upcoming runs for schedule configuration (protected)
router.post('/preview', protect, scheduleController.previewSchedule);

// GET /api/schedules/workflow/:workflowId — list all schedules for a workflow (protected)
router.get('/workflow/:workflowId', protect, scheduleController.getSchedulesByWorkflow);

// GET /api/schedules/:id/history — get execution history for a schedule (protected)
router.get('/:id/history', protect, scheduleController.getScheduleHistory);

// POST /api/schedules/:id/toggle — toggle enabled status (protected)
router.post('/:id/toggle', protect, scheduleController.toggleSchedule);

// GET /api/schedules/:id — get schedule detail (protected)
router.get('/:id', protect, scheduleController.getScheduleDetail);

// POST /api/schedules — create a schedule (protected)
router.post('/', protect, scheduleController.createSchedule);

// PUT /api/schedules/:id — update a schedule (protected)
router.put('/:id', protect, scheduleController.updateSchedule);

// DELETE /api/schedules/:id — delete a schedule (protected)
router.delete('/:id', protect, scheduleController.deleteSchedule);

module.exports = router;


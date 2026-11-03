const { scheduleManager } = require('../services');
const { success, error } = require('../utils/ResponseHelper');

/**
 * Get all schedules for a workflow
 * GET /api/schedules/workflow/:workflowId
 */
const getSchedulesByWorkflow = async (req, res, next) => {
  try {
    const schedules = await scheduleManager.getSchedulesByWorkflow(req.params.workflowId, req.user._id);
    return success(res, schedules);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Get single schedule detail
 * GET /api/schedules/:id
 */
const getScheduleDetail = async (req, res, next) => {
  try {
    const schedule = await scheduleManager.getScheduleById(req.params.id, req.user._id);
    return success(res, schedule);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Create a new schedule
 * POST /api/schedules
 */
const createSchedule = async (req, res, next) => {
  try {
    const created = await scheduleManager.createSchedule(req.body, req.user._id);
    return success(res, created, 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Update an existing schedule
 * PUT /api/schedules/:id
 */
const updateSchedule = async (req, res, next) => {
  try {
    const updated = await scheduleManager.updateSchedule(req.params.id, req.body, req.user._id);
    return success(res, updated);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Toggle schedule enable/disable
 * POST /api/schedules/:id/toggle
 */
const toggleSchedule = async (req, res, next) => {
  try {
    const toggled = await scheduleManager.toggleSchedule(req.params.id, req.user._id);
    return success(res, toggled);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Delete a schedule
 * DELETE /api/schedules/:id
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const deleted = await scheduleManager.deleteSchedule(req.params.id, req.user._id);
    return success(res, { message: 'Schedule deleted successfully', id: deleted._id });
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Preview upcoming runs
 * POST /api/schedules/preview
 */
const previewSchedule = async (req, res, next) => {
  try {
    const count = parseInt(req.query.count || req.body.count || 5, 10);
    const previews = scheduleManager.getNextRunsPreview(req.body, count);
    return success(res, { previews });
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * Get execution history for a schedule
 * GET /api/schedules/:id/history
 */
const getScheduleHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 20, 10);
    const history = await scheduleManager.getScheduleHistory(req.params.id, req.user._id, limit);
    return success(res, history);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

module.exports = {
  getSchedulesByWorkflow,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  toggleSchedule,
  deleteSchedule,
  previewSchedule,
  getScheduleHistory,
};


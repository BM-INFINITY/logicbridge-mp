const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const workflowEngine = require('./workflowEngine');
const { WorkflowStatus, ExecutionStatus } = require('../constants');

// Worker identifier unique to this process instance
const WORKER_ID = `worker_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes lock TTL

let pollIntervalTimer = null;

/**
 * Validates whether a timezone identifier is a supported IANA string
 * @param {string} tz
 * @returns {boolean}
 */
function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts local wall-clock components in a timezone into a UTC Date object
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day 1-31
 * @param {number} hour 0-23
 * @param {number} minute 0-59
 * @param {number} second 0-59
 * @param {string} timezone
 * @returns {Date}
 */
function localToUtc(year, month, day, hour, minute, second = 0, timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const estDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(estDate).map((p) => [p.type, p.value]));
  const tzHour = parseInt(parts.hour === '24' ? '0' : parts.hour, 10);
  const tzDay = parseInt(parts.day, 10);
  const tzMonth = parseInt(parts.month, 10);
  const tzYear = parseInt(parts.year, 10);
  const tzMinute = parseInt(parts.minute, 10);
  const tzSecond = parseInt(parts.second, 10);

  const targetUtcTime = Date.UTC(year, month - 1, day, hour, minute, second);
  const actualTzTime = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
  const diff = targetUtcTime - actualTzTime;
  return new Date(estDate.getTime() + diff);
}

/**
 * Extracts wall-clock date parts of a UTC Date in a given timezone
 * @param {Date} date
 * @param {string} timezone
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, dayOfWeek: number }}
 */
function getPartsInTimezone(date, timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour === '24' ? '0' : parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
  };
}

/**
 * Evaluates whether a value matches a cron field pattern (*, single, comma list, range, step)
 * @param {string} pattern
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function fieldMatches(pattern, value, min, max) {
  if (pattern === '*' || pattern === '?') return true;
  const parts = pattern.split(',');
  for (const part of parts) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) continue;
      if (range === '*') {
        if ((value - min) % step === 0) return true;
      } else if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        if (value >= start && value <= end && (value - start) % step === 0) return true;
      } else {
        const start = parseInt(range, 10);
        if (value >= start && value <= max && (value - start) % step === 0) return true;
      }
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (value >= start && value <= end) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }
  return false;
}

/**
 * Calculates the next UTC run date based on schedule configuration
 * @param {object} config
 * @param {Date} [fromDate=new Date()]
 * @returns {Date|null}
 */
function calculateNextRun(config, fromDate = new Date()) {
  const timezone = isValidTimezone(config.timezone) ? config.timezone : 'UTC';
  const startDate = config.startDate ? new Date(config.startDate) : null;
  const endDate = config.endDate ? new Date(config.endDate) : null;

  // Base search start is either fromDate or startDate, whichever is later
  let searchFrom = fromDate;
  if (startDate && startDate > searchFrom) {
    searchFrom = new Date(startDate.getTime() - 1000); // 1s before to allow exact startDate match
  }

  // 1. One-time execution
  if (config.type === 'once') {
    if (!config.executionDate) return null;
    const target = new Date(config.executionDate);
    if (isNaN(target.getTime())) return null;
    if (target <= fromDate) return null;
    if (startDate && target < startDate) return null;
    if (endDate && target > endDate) return null;
    return target;
  }

  // Parse time "HH:mm"
  const [tHourStr, tMinStr] = String(config.time || '09:00').split(':');
  const targetHour = Math.min(23, Math.max(0, parseInt(tHourStr || '9', 10)));
  const targetMinute = Math.min(59, Math.max(0, parseInt(tMinStr || '0', 10)));

  // 2. Daily recurrence
  if (config.recurrence === 'daily') {
    // Check today, then next 365 days
    let cur = getPartsInTimezone(searchFrom, timezone);
    for (let dayOffset = 0; dayOffset <= 366; dayOffset++) {
      const candidateLocal = new Date(Date.UTC(cur.year, cur.month - 1, cur.day + dayOffset));
      const candYear = candidateLocal.getUTCFullYear();
      const candMonth = candidateLocal.getUTCMonth() + 1;
      const candDay = candidateLocal.getUTCDate();

      const candidateUtc = localToUtc(candYear, candMonth, candDay, targetHour, targetMinute, 0, timezone);
      if (candidateUtc > searchFrom) {
        if (endDate && candidateUtc > endDate) return null;
        return candidateUtc;
      }
    }
    return null;
  }

  // 3. Weekly recurrence
  if (config.recurrence === 'weekly') {
    let days = Array.isArray(config.daysOfWeek) && config.daysOfWeek.length > 0
      ? config.daysOfWeek.map(Number)
      : [1]; // Default Monday
    days = days.filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    if (days.length === 0) days = [1];

    const cur = getPartsInTimezone(searchFrom, timezone);
    for (let dayOffset = 0; dayOffset <= 366; dayOffset++) {
      const candidateLocal = new Date(Date.UTC(cur.year, cur.month - 1, cur.day + dayOffset));
      const candYear = candidateLocal.getUTCFullYear();
      const candMonth = candidateLocal.getUTCMonth() + 1;
      const candDay = candidateLocal.getUTCDate();
      const candDayOfWeek = candidateLocal.getUTCDay();

      if (days.includes(candDayOfWeek)) {
        const candidateUtc = localToUtc(candYear, candMonth, candDay, targetHour, targetMinute, 0, timezone);
        if (candidateUtc > searchFrom) {
          if (endDate && candidateUtc > endDate) return null;
          return candidateUtc;
        }
      }
    }
    return null;
  }

  // 4. Monthly recurrence
  if (config.recurrence === 'monthly') {
    const targetDay = Math.min(31, Math.max(1, parseInt(config.dayOfMonth || '1', 10)));
    const cur = getPartsInTimezone(searchFrom, timezone);

    for (let monthOffset = 0; monthOffset <= 48; monthOffset++) {
      // Calculate month and year
      const totalMonths = (cur.month - 1) + monthOffset;
      const candYear = cur.year + Math.floor(totalMonths / 12);
      const candMonth = (totalMonths % 12) + 1;

      // Clamp targetDay to max days in this month
      const daysInMonth = new Date(Date.UTC(candYear, candMonth, 0)).getUTCDate();
      const actualDay = Math.min(targetDay, daysInMonth);

      const candidateUtc = localToUtc(candYear, candMonth, actualDay, targetHour, targetMinute, 0, timezone);
      if (candidateUtc > searchFrom) {
        if (endDate && candidateUtc > endDate) return null;
        return candidateUtc;
      }
    }
    return null;
  }

  // 5. Cron recurrence
  if (config.recurrence === 'cron') {
    const expr = String(config.cronExpression || '').trim();
    if (!cron.validate(expr)) return null;

    const fields = expr.split(/\s+/);
    if (fields.length !== 5) return null;
    const [minPat, hourPat, domPat, monthPat, dowPat] = fields;

    // Advance to next full minute
    let checkDate = new Date(searchFrom.getTime());
    checkDate.setUTCSeconds(0, 0);
    checkDate = new Date(checkDate.getTime() + 60000);

    // Search up to 525600 minutes (1 year)
    // Step by minute, optimizing hour/day skips if possible
    const maxSearchTime = searchFrom.getTime() + 366 * 24 * 60 * 60 * 1000;

    while (checkDate.getTime() <= maxSearchTime) {
      const parts = getPartsInTimezone(checkDate, timezone);

      if (!fieldMatches(monthPat, parts.month, 1, 12)) {
        // Skip rest of month
        checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
        continue;
      }

      const domMatch = fieldMatches(domPat, parts.day, 1, 31);
      // In cron, 0 and 7 can both represent Sunday
      const dowVal = parts.dayOfWeek === 0 ? 0 : parts.dayOfWeek;
      const dowMatch = fieldMatches(dowPat, dowVal, 0, 7) || (parts.dayOfWeek === 0 && fieldMatches(dowPat, 7, 0, 7));

      // Standard cron: if both DOM and DOW are specified (not *), OR is applied; otherwise AND
      const dayMatches = (domPat === '*' || domPat === '?') ? dowMatch : (dowPat === '*' || dowPat === '?') ? domMatch : (domMatch || dowMatch);

      if (!dayMatches) {
        // Skip rest of day
        checkDate = new Date(checkDate.getTime() + 60 * 60 * 1000);
        continue;
      }

      if (!fieldMatches(hourPat, parts.hour, 0, 23)) {
        // Advance to next hour
        checkDate = new Date(checkDate.getTime() + 60000);
        continue;
      }

      if (fieldMatches(minPat, parts.minute, 0, 59)) {
        if (endDate && checkDate > endDate) return null;
        return checkDate;
      }

      checkDate = new Date(checkDate.getTime() + 60000);
    }
    return null;
  }

  return null;
}

/**
 * Generates preview of next N scheduled execution timestamps
 * @param {object} config
 * @param {number} [count=5]
 * @param {Date} [fromDate=new Date()]
 * @returns {Array<string>} ISO timestamps
 */
function getNextRunsPreview(config, count = 5, fromDate = new Date()) {
  const previews = [];
  let currentFrom = new Date(fromDate.getTime());

  for (let i = 0; i < count; i++) {
    const next = calculateNextRun(config, currentFrom);
    if (!next) break;
    previews.push(next.toISOString());
    // Advance search start slightly past the calculated next run
    currentFrom = new Date(next.getTime() + 1000);
    if (config.type === 'once') break;
  }

  return previews;
}

/**
 * Claims due schedules atomically using distributed locks
 * @param {string} workerId
 * @param {number} [limit=10]
 * @returns {Promise<Array>} List of claimed Schedule documents
 */
async function claimDueSchedules(workerId = WORKER_ID, limit = 10) {
  const now = new Date();

  // Find due schedules that are unlocked or have expired locks
  const candidates = await Schedule.find({
    enabled: true,
    status: 'active',
    nextRunAt: { $lte: now },
    $or: [
      { lockedAt: null },
      { lockExpiresAt: { $lt: now } },
    ],
  }).limit(limit);

  const claimed = [];
  for (const cand of candidates) {
    const claimedDoc = await Schedule.findOneAndUpdate(
      {
        _id: cand._id,
        enabled: true,
        status: 'active',
        $or: [
          { lockedAt: null },
          { lockExpiresAt: { $lt: now } },
        ],
      },
      {
        $set: {
          lockedAt: now,
          lockedBy: workerId,
          lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
        },
      },
      { new: true }
    );

    if (claimedDoc) {
      claimed.push(claimedDoc);
    }
  }

  return claimed;
}

/**
 * Executes a claimed schedule with overlap prevention and catch-up handling
 * @param {object} schedule - Mongoose Schedule document
 * @param {string} [workerId=WORKER_ID]
 * @returns {Promise<object>} Execution result summary
 */
async function executeSchedule(schedule, workerId = WORKER_ID) {
  const now = new Date();

  try {
    const workflow = await Workflow.findById(schedule.workflow);
    if (!workflow) {
      console.warn(`[ScheduleManager] Workflow ${schedule.workflow} not found for schedule ${schedule._id}`);
      schedule.status = 'paused';
      schedule.lockedAt = null;
      schedule.lockedBy = null;
      schedule.lockExpiresAt = null;
      await schedule.save();
      return { skipped: true, reason: 'workflow_not_found' };
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      console.log(`[ScheduleManager] Workflow "${workflow.name}" is not active (${workflow.status}); pausing schedule.`);
      schedule.lockedAt = null;
      schedule.lockedBy = null;
      schedule.lockExpiresAt = null;
      await schedule.save();
      return { skipped: true, reason: 'workflow_inactive' };
    }

    // 1. Execution Overlap Prevention
    if (schedule.preventOverlap !== false) {
      const activeExecution = await Execution.findOne({
        workflow: schedule.workflow,
        status: { $in: [ExecutionStatus.RUNNING, ExecutionStatus.WAITING_APPROVAL, ExecutionStatus.PAUSED] },
      });

      if (activeExecution) {
        console.warn(`[ScheduleManager] Overlap prevented for workflow "${workflow.name}". Execution ${activeExecution._id} is active.`);
        // Reschedule to next slot without spawning duplicate run
        const next = calculateNextRun(schedule, now);
        schedule.nextRunAt = next;
        if (!next) {
          schedule.status = 'completed';
          schedule.enabled = false;
        }
        schedule.lockedAt = null;
        schedule.lockedBy = null;
        schedule.lockExpiresAt = null;
        await schedule.save();
        return { skipped: true, reason: 'overlap_prevented', activeExecutionId: activeExecution._id };
      }
    }

    // 2. Catch-up policy handling for downtime recovery
    const scheduledTime = schedule.nextRunAt || now;
    const isPastDue = now.getTime() - new Date(scheduledTime).getTime() > 10 * 60 * 1000; // >10m late

    if (isPastDue && schedule.catchUpPolicy === 'skip') {
      console.log(`[ScheduleManager] Catch-up policy 'skip' active for schedule ${schedule._id} (missed at ${scheduledTime.toISOString()})`);
      const next = calculateNextRun(schedule, now);
      schedule.nextRunAt = next;
      if (!next) {
        schedule.status = 'completed';
        schedule.enabled = false;
      }
      schedule.lockedAt = null;
      schedule.lockedBy = null;
      schedule.lockExpiresAt = null;
      await schedule.save();
      return { skipped: true, reason: 'catch_up_skipped' };
    }

    // 3. Trigger Workflow Execution
    console.log(`[ScheduleManager] Triggering workflow "${workflow.name}" via schedule ${schedule._id}`);
    const triggerPayload = {
      scheduleId: String(schedule._id),
      scheduleName: schedule.name,
      scheduledTime: scheduledTime.toISOString(),
      timezone: schedule.timezone,
      recurrence: schedule.recurrence,
      type: schedule.type,
    };

    const execution = await workflowEngine.run(workflow, schedule.owner, 'schedule', triggerPayload);

    // 4. Update Schedule stats and compute next run
    schedule.lastRunAt = now;
    schedule.lastExecution = execution._id;
    schedule.runCount = (schedule.runCount || 0) + 1;

    if (schedule.type === 'once') {
      schedule.status = 'completed';
      schedule.enabled = false;
      schedule.nextRunAt = null;
    } else {
      const next = calculateNextRun(schedule, now);
      schedule.nextRunAt = next;
      if (!next) {
        schedule.status = 'completed';
        schedule.enabled = false;
      }
    }

    // Release distributed lock
    schedule.lockedAt = null;
    schedule.lockedBy = null;
    schedule.lockExpiresAt = null;
    await schedule.save();

    return { success: true, executionId: execution._id };
  } catch (err) {
    console.error(`[ScheduleManager] Failed to execute schedule ${schedule._id}:`, err.message);
    // Release lock on error and reschedule to prevent deadlocks
    schedule.lockedAt = null;
    schedule.lockedBy = null;
    schedule.lockExpiresAt = null;
    try {
      const next = calculateNextRun(schedule, new Date(now.getTime() + 60000));
      schedule.nextRunAt = next;
      await schedule.save();
    } catch {
      // Ignore fallback save error
    }
    return { success: false, error: err.message };
  }
}

/**
 * Polling step that claims and runs due schedules
 */
async function pollAndExecute() {
  try {
    const claimed = await claimDueSchedules(WORKER_ID, 10);
    if (claimed.length > 0) {
      console.log(`[ScheduleManager] Worker ${WORKER_ID} claimed ${claimed.length} due schedule(s)`);
      for (const schedule of claimed) {
        await executeSchedule(schedule, WORKER_ID);
      }
    }
  } catch (err) {
    console.error('[ScheduleManager] Poll error:', err.message);
  }
}

/**
 * Starts the durable schedule polling worker
 * @param {number} [intervalMs=10000]
 */
function start(intervalMs = 10000) {
  if (pollIntervalTimer) return;
  console.log(`[ScheduleManager] Starting durable scheduler worker (every ${intervalMs}ms)`);
  pollIntervalTimer = setInterval(pollAndExecute, intervalMs);
  // Run an immediate poll cycle
  pollAndExecute();
}

/**
 * Stops the durable schedule polling worker
 */
function stop() {
  if (pollIntervalTimer) {
    clearInterval(pollIntervalTimer);
    pollIntervalTimer = null;
    console.log('[ScheduleManager] Stopped durable scheduler worker');
  }
}

// ── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Creates a new schedule for a workflow
 */
async function createSchedule(data, ownerId) {
  const {
    workflowId,
    name,
    type = 'recurring',
    recurrence = 'daily',
    time = '09:00',
    daysOfWeek = [1],
    dayOfMonth = 1,
    cronExpression = '',
    timezone = 'UTC',
    startDate = null,
    endDate = null,
    executionDate = null,
    preventOverlap = true,
    catchUpPolicy = 'skip',
    enabled = true,
  } = data;

  const workflow = await Workflow.findOne({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }

  if (recurrence === 'cron' && type === 'recurring') {
    if (!cron.validate(cronExpression)) {
      const error = new Error(`Invalid cron expression "${cronExpression}"`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (!isValidTimezone(timezone)) {
    const error = new Error(`Invalid timezone "${timezone}"`);
    error.statusCode = 400;
    throw error;
  }

  const scheduleConfig = {
    workflow: workflowId,
    owner: ownerId,
    name: name || 'Scheduled Trigger',
    type,
    recurrence,
    time,
    daysOfWeek,
    dayOfMonth,
    cronExpression,
    timezone,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    executionDate: executionDate ? new Date(executionDate) : null,
    preventOverlap: preventOverlap !== false,
    catchUpPolicy,
    enabled,
    status: enabled ? 'active' : 'paused',
  };

  const nextRunAt = enabled ? calculateNextRun(scheduleConfig, new Date()) : null;
  scheduleConfig.nextRunAt = nextRunAt;

  return Schedule.create(scheduleConfig);
}

/**
 * Updates an existing schedule
 */
async function updateSchedule(scheduleId, data, ownerId) {
  const existing = await Schedule.findOne({ _id: scheduleId, owner: ownerId });
  if (!existing) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }

  const fields = [
    'name', 'type', 'recurrence', 'time', 'daysOfWeek', 'dayOfMonth',
    'cronExpression', 'timezone', 'startDate', 'endDate', 'executionDate',
    'preventOverlap', 'catchUpPolicy', 'enabled', 'status',
  ];

  fields.forEach((f) => {
    if (data[f] !== undefined) {
      existing[f] = data[f];
    }
  });

  if (existing.recurrence === 'cron' && existing.type === 'recurring') {
    if (!cron.validate(existing.cronExpression)) {
      const error = new Error(`Invalid cron expression "${existing.cronExpression}"`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (!isValidTimezone(existing.timezone)) {
    const error = new Error(`Invalid timezone "${existing.timezone}"`);
    error.statusCode = 400;
    throw error;
  }

  if (existing.enabled && existing.status !== 'completed') {
    existing.status = 'active';
    existing.nextRunAt = calculateNextRun(existing, new Date());
  } else {
    existing.status = existing.status === 'completed' ? 'completed' : 'paused';
    existing.nextRunAt = null;
  }

  return existing.save();
}

/**
 * Toggles a schedule between enabled/active and paused
 */
async function toggleSchedule(scheduleId, ownerId) {
  const existing = await Schedule.findOne({ _id: scheduleId, owner: ownerId });
  if (!existing) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }

  const newEnabled = !existing.enabled;
  existing.enabled = newEnabled;
  if (newEnabled) {
    existing.status = 'active';
    existing.nextRunAt = calculateNextRun(existing, new Date());
  } else {
    existing.status = 'paused';
    existing.nextRunAt = null;
  }

  return existing.save();
}

/**
 * Deletes a schedule
 */
async function deleteSchedule(scheduleId, ownerId) {
  const existing = await Schedule.findOneAndDelete({ _id: scheduleId, owner: ownerId });
  if (!existing) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }
  return existing;
}

/**
 * Gets all schedules for a workflow
 */
async function getSchedulesByWorkflow(workflowId, ownerId) {
  return Schedule.find({ workflow: workflowId, owner: ownerId }).sort({ createdAt: -1 });
}

/**
 * Gets a schedule by ID
 */
async function getScheduleById(scheduleId, ownerId) {
  const schedule = await Schedule.findOne({ _id: scheduleId, owner: ownerId }).populate('lastExecution');
  if (!schedule) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }
  return schedule;
}

/**
 * Gets execution history triggered by a schedule
 */
async function getScheduleHistory(scheduleId, ownerId, limit = 20) {
  const schedule = await Schedule.findOne({ _id: scheduleId, owner: ownerId });
  if (!schedule) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }

  return Execution.find({
    workflow: schedule.workflow,
    owner: ownerId,
    trigger: 'schedule',
  })
    .sort({ startedAt: -1 })
    .limit(limit);
}

module.exports = {
  isValidTimezone,
  localToUtc,
  getPartsInTimezone,
  fieldMatches,
  calculateNextRun,
  getNextRunsPreview,
  claimDueSchedules,
  executeSchedule,
  pollAndExecute,
  start,
  stop,
  createSchedule,
  updateSchedule,
  toggleSchedule,
  deleteSchedule,
  getSchedulesByWorkflow,
  getScheduleById,
  getScheduleHistory,
  WORKER_ID,
};


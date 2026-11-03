const Schedule = require('../models/Schedule');
const scheduleManager = require('./scheduleManager');

/**
 * Ensures a durable Schedule document exists for a workflow with trigger-schedule
 * @param {object} workflow
 */
async function scheduleWorkflow(workflow) {
  try {
    const cronExpr = workflow.nodes?.find((n) => n.type === 'trigger-schedule')?.data?.cron || workflow.schedule?.cron;
    if (!cronExpr) return;

    // Check if a schedule already exists for this workflow
    let schedule = await Schedule.findOne({ workflow: workflow._id, owner: workflow.owner });
    if (!schedule) {
      schedule = await scheduleManager.createSchedule(
        {
          workflowId: workflow._id,
          name: `${workflow.name} Schedule`,
          type: 'recurring',
          recurrence: 'cron',
          cronExpression: cronExpr,
          timezone: 'UTC',
          enabled: true,
        },
        workflow.owner
      );
      console.log(`[Scheduler] Created durable schedule for "${workflow.name}" (${cronExpr})`);
    } else {
      schedule.cronExpression = cronExpr;
      schedule.recurrence = 'cron';
      schedule.enabled = true;
      schedule.status = 'active';
      schedule.nextRunAt = scheduleManager.calculateNextRun(schedule, new Date());
      await schedule.save();
      console.log(`[Scheduler] Updated durable schedule for "${workflow.name}" (${cronExpr})`);
    }
  } catch (err) {
    console.error(`[Scheduler] scheduleWorkflow failed for ${workflow._id}:`, err.message);
  }
}

/**
 * Pauses or disables the durable schedule for a workflow
 * @param {string} workflowId
 */
async function unscheduleWorkflow(workflowId) {
  try {
    const schedule = await Schedule.findOne({ workflow: workflowId });
    if (schedule) {
      schedule.enabled = false;
      schedule.status = 'paused';
      schedule.nextRunAt = null;
      await schedule.save();
      console.log(`[Scheduler] Paused durable schedule for workflow ${workflowId}`);
    }
  } catch (err) {
    console.error(`[Scheduler] unscheduleWorkflow failed for ${workflowId}:`, err.message);
  }
}

/**
 * Initializes durable schedule manager on backend startup
 */
async function initScheduler() {
  try {
    // Start durable polling worker
    scheduleManager.start(10000);
    console.log('[Scheduler] Durable ScheduleManager initialized successfully');
  } catch (err) {
    console.error('[Scheduler] Init failed:', err.message);
  }
}

module.exports = {
  scheduleWorkflow,
  unscheduleWorkflow,
  initScheduler,
  scheduleManager,
};

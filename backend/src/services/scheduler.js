const cron = require('node-cron');
const Workflow = require('../models/Workflow');
const workflowEngine = require('./workflowEngine');

const activeTasks = new Map(); // workflowId → cron task

/**
 * Start cron job for a single workflow
 */
function scheduleWorkflow(workflow) {
  const cronExpr = workflow.nodes?.find(n => n.type === 'trigger-schedule')?.data?.cron;
  if (!cronExpr) return;
  if (!cron.validate(cronExpr)) {
    console.warn(`[Scheduler] Invalid cron "${cronExpr}" for workflow "${workflow.name}"`);
    return;
  }

  // Cancel existing task if re-scheduling
  if (activeTasks.has(String(workflow._id))) {
    activeTasks.get(String(workflow._id)).stop();
  }

  const task = cron.schedule(cronExpr, async () => {
    console.log(`[Scheduler] Running workflow "${workflow.name}" (${workflow._id})`);
    try {
      const fresh = await Workflow.findById(workflow._id);
      if (!fresh || fresh.status !== 'active') return;
      await workflowEngine.run(fresh, fresh.owner, 'schedule');
      console.log(`[Scheduler] ✅ Workflow "${workflow.name}" completed`);
    } catch (err) {
      console.error(`[Scheduler] ❌ Workflow "${workflow.name}" failed:`, err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  activeTasks.set(String(workflow._id), task);
  console.log(`[Scheduler] Scheduled "${workflow.name}" → cron: ${cronExpr} (IST)`);
}

/**
 * Stop a scheduled workflow
 */
function unscheduleWorkflow(workflowId) {
  const id = String(workflowId);
  if (activeTasks.has(id)) {
    activeTasks.get(id).stop();
    activeTasks.delete(id);
    console.log(`[Scheduler] Stopped schedule for workflow ${id}`);
  }
}

/**
 * Load all active scheduled workflows from DB on server start
 */
async function initScheduler() {
  try {
    const workflows = await Workflow.find({ status: 'active' });
    let count = 0;
    for (const wf of workflows) {
      const hasScheduleTrigger = wf.nodes?.some(n => n.type === 'trigger-schedule');
      if (hasScheduleTrigger) { scheduleWorkflow(wf); count++; }
    }
    console.log(`[Scheduler] Initialized ${count} scheduled workflow(s)`);
  } catch (err) {
    console.error('[Scheduler] Init failed:', err.message);
  }
}

module.exports = { scheduleWorkflow, unscheduleWorkflow, initScheduler };

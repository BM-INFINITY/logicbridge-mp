/**
 * scheduleDurable.test.js
 *
 * Comprehensive tests for Durable Scheduling Architecture:
 * 1. Timezone validation & local-to-UTC wall-clock conversions (EDT, EST, IST, UTC)
 * 2. Next run calculation engine (once, daily, weekly, monthly, cron)
 * 3. Schedule effective window (startDate & endDate constraints)
 * 4. Next run preview generation
 * 5. Multi-worker distributed claiming & atomic lock acquisition
 * 6. Lock expiration and stale lock recovery
 * 7. Execution overlap prevention (preventOverlap: true)
 * 8. Downtime recovery & catch-up policy (skip vs run_latest)
 * 9. Wait resume token single-use & expiration security enforcement
 */

const assert = require('assert');
const scheduleManager = require('../services/scheduleManager');
const executionService = require('../services/executionService');
const Execution = require('../models/Execution');
const Schedule = require('../models/Schedule');
const Workflow = require('../models/Workflow');
const { ExecutionStatus, WorkflowStatus } = require('../constants');

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Durable Scheduling Architecture Tests...\n');

  // ── Group 1: Timezone Validation & Wall-Clock Conversions ─────────────────
  console.log('Group 1: Timezone Validation & Wall-Clock Conversions');
  {
    check('Validates UTC', scheduleManager.isValidTimezone('UTC'));
    check('Validates America/New_York', scheduleManager.isValidTimezone('America/New_York'));
    check('Validates Asia/Kolkata', scheduleManager.isValidTimezone('Asia/Kolkata'));
    check('Validates Europe/London', scheduleManager.isValidTimezone('Europe/London'));
    check('Rejects invalid timezone name', !scheduleManager.isValidTimezone('Invalid/Nonexistent_Timezone'));
    check('Rejects non-string timezone', !scheduleManager.isValidTimezone(null));

    // Summer EDT (UTC-4): 09:30 AM NYC -> 13:30 UTC
    const nycSummer = scheduleManager.localToUtc(2026, 6, 1, 9, 30, 0, 'America/New_York');
    check('Converts NYC summer 09:30 to 13:30 UTC', nycSummer.toISOString() === '2026-06-01T13:30:00.000Z');

    // Winter EST (UTC-5): 09:30 AM NYC -> 14:30 UTC
    const nycWinter = scheduleManager.localToUtc(2026, 1, 15, 9, 30, 0, 'America/New_York');
    check('Converts NYC winter 09:30 to 14:30 UTC', nycWinter.toISOString() === '2026-01-15T14:30:00.000Z');

    // Asia/Kolkata (UTC+5:30): 09:30 AM IST -> 04:00 UTC
    const ist = scheduleManager.localToUtc(2026, 6, 1, 9, 30, 0, 'Asia/Kolkata');
    check('Converts IST 09:30 to 04:00 UTC', ist.toISOString() === '2026-06-01T04:00:00.000Z');
  }

  // ── Group 2: Next Run Calculation Engine ───────────────────────────────────
  console.log('\nGroup 2: Next Run Calculation Engine');
  {
    const baseDate = new Date('2026-06-01T10:00:00Z'); // 10:00 UTC = 06:00 EDT

    // 1. Once (future)
    const onceFuture = scheduleManager.calculateNextRun(
      { type: 'once', executionDate: '2026-06-02T15:00:00Z' },
      baseDate
    );
    check('Once: returns exact future target timestamp', onceFuture.toISOString() === '2026-06-02T15:00:00.000Z');

    // 2. Once (past) -> null (completed)
    const oncePast = scheduleManager.calculateNextRun(
      { type: 'once', executionDate: '2026-05-30T10:00:00Z' },
      baseDate
    );
    check('Once: returns null for past date', oncePast === null);

    // 3. Daily: 14:00 UTC (today has not happened yet)
    const dailyToday = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'daily', time: '14:00', timezone: 'UTC' },
      baseDate
    );
    check('Daily: schedules for today if time is in future', dailyToday.toISOString() === '2026-06-01T14:00:00.000Z');

    // 4. Daily: 08:00 UTC (today already passed) -> tomorrow
    const dailyTomorrow = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'daily', time: '08:00', timezone: 'UTC' },
      baseDate
    );
    check('Daily: advances to tomorrow if time has already passed today', dailyTomorrow.toISOString() === '2026-06-02T08:00:00.000Z');

    // 5. Weekly: 2026-06-01 is Monday (1). Schedule for Wednesdays (3) at 10:00 UTC
    const weeklyWed = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'weekly', time: '10:00', daysOfWeek: [3], timezone: 'UTC' },
      baseDate
    );
    check('Weekly: schedules next Wednesday', weeklyWed.toISOString() === '2026-06-03T10:00:00.000Z');

    // 6. Monthly: schedule for 15th of the month at 12:00 UTC
    const monthlyRun = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'monthly', time: '12:00', dayOfMonth: 15, timezone: 'UTC' },
      baseDate
    );
    check('Monthly: schedules for 15th of the current month', monthlyRun.toISOString() === '2026-06-15T12:00:00.000Z');

    // 7. Cron: every 15 minutes
    const cron15m = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'cron', cronExpression: '*/15 * * * *', timezone: 'UTC' },
      baseDate
    );
    check('Cron: calculates next 15-minute mark', cron15m.toISOString() === '2026-06-01T10:15:00.000Z');
  }

  // ── Group 3: Schedule Effective Window (Start & End Dates) ────────────────
  console.log('\nGroup 3: Schedule Effective Window (Start & End Dates)');
  {
    const baseDate = new Date('2026-06-01T10:00:00Z');

    // Future start date
    const futureStart = new Date('2026-07-01T00:00:00Z');
    const startRun = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'daily', time: '12:00', startDate: futureStart, timezone: 'UTC' },
      baseDate
    );
    check('Respects startDate and starts on or after start date', startRun >= futureStart);
    check('Calculates first execution on start date', startRun.toISOString() === '2026-07-01T12:00:00.000Z');

    // Past end date
    const pastEnd = new Date('2026-06-02T00:00:00Z');
    const endedRun = scheduleManager.calculateNextRun(
      { type: 'recurring', recurrence: 'weekly', time: '12:00', daysOfWeek: [5], endDate: pastEnd, timezone: 'UTC' },
      baseDate
    );
    check('Returns null when next run exceeds endDate', endedRun === null);
  }

  // ── Group 4: Next Runs Preview ────────────────────────────────────────────
  console.log('\nGroup 4: Next Runs Preview');
  {
    const baseDate = new Date('2026-06-01T08:00:00Z');
    const previews = scheduleManager.getNextRunsPreview(
      { type: 'recurring', recurrence: 'daily', time: '10:00', timezone: 'UTC' },
      5,
      baseDate
    );
    check('Generates exactly 5 previews', previews.length === 5);
    check('Previews are strictly ascending in time', previews.every((p, idx) => idx === 0 || new Date(p) > new Date(previews[idx - 1])));
    check('First preview is today at 10:00', previews[0] === '2026-06-01T10:00:00.000Z');
    check('Second preview is tomorrow at 10:00', previews[1] === '2026-06-02T10:00:00.000Z');
  }

  // ── Group 5: Distributed Claiming & Atomic Worker Locking ─────────────────
  console.log('\nGroup 5: Distributed Claiming & Atomic Worker Locking');
  {
    // Mock Schedule document with atomic findOneAndUpdate behavior
    let currentLockedBy = null;
    let currentLockedAt = null;
    let currentLockExpiresAt = null;

    const mockScheduleDoc = {
      _id: 'sched_123',
      workflow: 'wf_456',
      enabled: true,
      status: 'active',
      nextRunAt: new Date(Date.now() - 5000), // Due 5 seconds ago
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      save: async function () { return this; },
    };

    const originalFind = Schedule.find;
    const originalFindOneAndUpdate = Schedule.findOneAndUpdate;

    Schedule.find = function () {
      return {
        limit: function () {
          // Return candidate if unlocked or expired
          const now = new Date();
          const isUnlocked = !currentLockedAt || (currentLockExpiresAt && currentLockExpiresAt < now);
          return Promise.resolve(isUnlocked ? [mockScheduleDoc] : []);
        },
      };
    };

    Schedule.findOneAndUpdate = async function (filter, update) {
      const now = new Date();
      const isUnlocked = !currentLockedAt || (currentLockExpiresAt && currentLockExpiresAt < now);
      if (isUnlocked) {
        currentLockedBy = update.$set.lockedBy;
        currentLockedAt = update.$set.lockedAt;
        currentLockExpiresAt = update.$set.lockExpiresAt;
        return {
          ...mockScheduleDoc,
          lockedBy: currentLockedBy,
          lockedAt: currentLockedAt,
          lockExpiresAt: currentLockExpiresAt,
          save: mockScheduleDoc.save,
        };
      }
      return null; // Atomic collision: another worker already claimed it
    };

    // Worker 1 claims
    const claimedByWorker1 = await scheduleManager.claimDueSchedules('worker_alpha', 5);
    check('Worker Alpha claims due schedule', claimedByWorker1.length === 1 && claimedByWorker1[0].lockedBy === 'worker_alpha');

    // Worker 2 attempts to claim simultaneously while Worker 1 holds lock
    const claimedByWorker2 = await scheduleManager.claimDueSchedules('worker_beta', 5);
    check('Worker Beta receives 0 schedules due to active lock (race condition prevented)', claimedByWorker2.length === 0);

    // Stale lock recovery: expire lock manually (>5 minutes ago)
    currentLockExpiresAt = new Date(Date.now() - 1000);
    const claimedAfterExpiry = await scheduleManager.claimDueSchedules('worker_gamma', 5);
    check('Worker Gamma reclaims schedule after stale lock expiry', claimedAfterExpiry.length === 1 && claimedAfterExpiry[0].lockedBy === 'worker_gamma');

    // Restore original methods
    Schedule.find = originalFind;
    Schedule.findOneAndUpdate = originalFindOneAndUpdate;
  }

  // ── Group 6: Execution Overlap Prevention ─────────────────────────────────
  console.log('\nGroup 6: Execution Overlap Prevention');
  {
    const originalWfFindById = Workflow.findById;
    const originalExecFindOne = Execution.findOne;

    Workflow.findById = async function () {
      return { _id: 'wf_test', name: 'Order Processing', status: WorkflowStatus.ACTIVE };
    };

    // Simulate an active running execution for this workflow
    Execution.findOne = async function () {
      return { _id: 'exec_running_999', status: ExecutionStatus.RUNNING };
    };

    const mockSchedule = {
      _id: 'sched_overlap',
      workflow: 'wf_test',
      owner: 'user_1',
      preventOverlap: true,
      recurrence: 'daily',
      time: '12:00',
      timezone: 'UTC',
      nextRunAt: new Date(),
      save: async function () { return this; },
    };

    const result = await scheduleManager.executeSchedule(mockSchedule, 'worker_test');
    check('Prevents overlapping execution when workflow is already running', result.skipped === true && result.reason === 'overlap_prevented');
    check('Records active execution ID that caused overlap prevention', result.activeExecutionId === 'exec_running_999');

    // Restore original methods
    Workflow.findById = originalWfFindById;
    Execution.findOne = originalExecFindOne;
  }

  // ── Group 7: Downtime Recovery & Catch-Up Policy ──────────────────────────
  console.log('\nGroup 7: Downtime Recovery & Catch-Up Policy');
  {
    const originalWfFindById = Workflow.findById;
    const originalExecFindOne = Execution.findOne;

    Workflow.findById = async function () {
      return { _id: 'wf_test', name: 'Billing', status: WorkflowStatus.ACTIVE };
    };
    Execution.findOne = async function () { return null; }; // No running executions

    const missedSchedule = {
      _id: 'sched_catchup',
      workflow: 'wf_test',
      owner: 'user_1',
      catchUpPolicy: 'skip',
      recurrence: 'daily',
      time: '10:00',
      timezone: 'UTC',
      nextRunAt: new Date(Date.now() - 3600000), // Missed 1 hour ago during server downtime
      save: async function () { return this; },
    };

    const result = await scheduleManager.executeSchedule(missedSchedule, 'worker_test');
    check('Catch-up policy "skip" safely skips missed execution after downtime', result.skipped === true && result.reason === 'catch_up_skipped');

    // Restore
    Workflow.findById = originalWfFindById;
    Execution.findOne = originalExecFindOne;
  }

  // ── Group 8: Single-Use and Expiration Enforcement for Wait Resume Tokens ─
  console.log('\nGroup 8: Single-Use & Expiration for Wait Resume Tokens');
  {
    const originalFindOne = Execution.findOne;

    // 1. Expired token test
    Execution.findOne = async function () {
      return {
        _id: 'exec_wait_expired',
        status: ExecutionStatus.PAUSED,
        wait: {
          status: 'waiting',
          resumeToken: 'token_123',
          timeoutAt: new Date(Date.now() - 60000), // Expired 1 min ago
        },
      };
    };

    let caughtError = null;
    try {
      await executionService.resumeByToken('token_123');
    } catch (err) {
      caughtError = err;
    }
    check('Rejects expired resume token with 410 Gone status', caughtError?.statusCode === 410 && caughtError?.message.includes('expired'));

    // 2. Replay test (already resumed / no longer waiting)
    Execution.findOne = async function () {
      return {
        _id: 'exec_wait_resumed',
        status: ExecutionStatus.SUCCESS, // Already finished
        wait: {
          status: 'resumed',
          resumeToken: null, // Cleared on resume
        },
      };
    };

    let replayError = null;
    try {
      await executionService.resumeByToken('token_replayed');
    } catch (err) {
      replayError = err;
    }
    check('Rejects replay of already resumed wait execution', replayError?.statusCode === 400);

    // Restore
    Execution.findOne = originalFindOne;
  }

  console.log(`\nDurable Scheduling Architecture Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


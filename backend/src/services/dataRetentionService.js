const mongoose = require('mongoose');
const Execution = require('../models/Execution');
const WebhookEvent = require('../models/WebhookEvent');
const AuditLogger = require('./AuditLogger');

/**
 * Data Retention & Lifecycle Management Service for LogicBridge.
 *
 * Implements bounded, safe data pruning for historical executions and webhook events:
 * - Only terminal executions (success, failed, expired, cancelled) are eligible.
 * - Active executions (running, paused, waiting, waiting_approval) are STRICTLY protected.
 * - Active checkpoints, pending approvals, wait resume tokens, and active worker leases are preserved.
 * - Webhook events with deduplication keys (eventIdentifier) have payloads pruned rather than
 *   deleted, preventing duplicate replay attacks while reclaiming storage.
 * - All operations support dry-run mode, bounded batching, and tenant isolation.
 */
class DataRetentionService {
  constructor() {
    this._cleanupTimer = null;
    this._isRunning = false;
  }

  /**
   * Retrieves retention configuration from environment with safe defaults.
   */
  getConfig() {
    return {
      executionRetentionDays: parseInt(process.env.EXECUTION_RETENTION_DAYS, 10) || 90,
      webhookEventRetentionDays: parseInt(process.env.WEBHOOK_EVENT_RETENTION_DAYS, 10) || 30,
      // Two-tier deduplication policy:
      // - Tier 1: Payloads pruned after WEBHOOK_EVENT_RETENTION_DAYS (default 30d), keeping deduplication stub
      // - Tier 2: Stubs purged after WEBHOOK_DEDUPLICATION_RETENTION_DAYS (default 180d, min 90d to prevent replay attacks)
      // Set to 0 to disable stub purging and retain stubs indefinitely
      webhookDeduplicationRetentionDays: parseInt(process.env.WEBHOOK_DEDUPLICATION_RETENTION_DAYS, 10) || 180,
      batchSize: parseInt(process.env.DATA_CLEANUP_BATCH_SIZE, 10) || 500,
      cleanupIntervalMs: parseInt(process.env.DATA_CLEANUP_INTERVAL_MS, 10) || 24 * 60 * 60 * 1000, // 24 hours default
      enabled: process.env.DATA_RETENTION_ENABLED !== 'false',
    };
  }

  /**
   * Safely cleans expired terminal executions.
   *
   * @param {object} [options={}] - Options { retentionDays, batchSize, dryRun, ownerId }
   * @returns {Promise<object>} Summary of deleted / eligible executions
   */
  async cleanExecutions(options = {}) {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return { success: false, reason: 'database_disconnected', deletedCount: 0 };
    }

    const config = this.getConfig();
    const retentionDays = options.retentionDays !== undefined ? options.retentionDays : config.executionRetentionDays;
    const batchSize = Math.max(1, options.batchSize || config.batchSize);
    const dryRun = Boolean(options.dryRun);

    if (retentionDays <= 0) {
      return { success: true, reason: 'retention_disabled', deletedCount: 0, eligibleCount: 0 };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    // Strict eligibility query: ONLY terminal executions older than cutoffDate.
    // Excludes: running, paused, waiting_approval, active approvals, active waits, active leases.
    const query = {
      status: { $in: ['success', 'failed', 'expired', 'cancelled'] },
      $or: [
        { finishedAt: { $lt: cutoffDate } },
        { finishedAt: null, startedAt: { $lt: cutoffDate } },
        { finishedAt: null, startedAt: null, createdAt: { $lt: cutoffDate } },
      ],
      // Explicit negative guards:
      'approval.status': { $ne: 'pending' },
      'wait.status': { $ne: 'waiting' },
      $and: [
        {
          $or: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { $lt: now } },
          ],
        },
      ],
    };

    if (options.ownerId) {
      query.owner = options.ownerId;
    }

    // Bounded query: find up to batchSize candidates
    const eligibleExecutions = await Execution.find(query)
      .select('_id workflow owner status startedAt finishedAt')
      .limit(batchSize)
      .lean();

    const eligibleCount = eligibleExecutions.length;

    if (eligibleCount === 0 || dryRun) {
      return {
        success: true,
        dryRun,
        retentionDays,
        cutoffDate,
        eligibleCount,
        deletedCount: 0,
        sampleIds: eligibleExecutions.slice(0, 5).map((e) => e._id),
      };
    }

    const idsToDelete = eligibleExecutions.map((e) => e._id);
    const deleteResult = await Execution.deleteMany({ _id: { $in: idsToDelete } });

    // Structured audit logging for significant pruning events
    try {
      await AuditLogger.log({
        eventType: 'workflow.security.action',
        category: 'SYSTEM',
        status: 'SUCCESS',
        actorId: 'system',
        details: {
          action: 'execution_retention_cleanup',
          deletedCount: deleteResult.deletedCount,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
        },
      });
    } catch {
      // Non-blocking logging
    }

    return {
      success: true,
      dryRun: false,
      retentionDays,
      cutoffDate,
      eligibleCount,
      deletedCount: deleteResult.deletedCount,
    };
  }

  /**
   * Safely cleans expired webhook events.
   *
   * Safeguard for Deduplication (DATA-01):
   * Events with an eventIdentifier (idempotency key) have their large payloads pruned
   * (body, headers, query set to empty) instead of being deleted outright.
   * This retains the idempotency index entry, preventing historical replays.
   * Events without an eventIdentifier are fully deleted.
   *
   * @param {object} [options={}] - Options { retentionDays, batchSize, dryRun, workflowId }
   * @returns {Promise<object>} Summary of deleted and pruned webhook events
   */
  async cleanWebhookEvents(options = {}) {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return { success: false, reason: 'database_disconnected', deletedCount: 0, prunedCount: 0 };
    }

    const config = this.getConfig();
    const retentionDays = options.retentionDays !== undefined ? options.retentionDays : config.webhookEventRetentionDays;
    const batchSize = Math.max(1, options.batchSize || config.batchSize);
    const dryRun = Boolean(options.dryRun);

    if (retentionDays <= 0) {
      return { success: true, reason: 'retention_disabled', deletedCount: 0, prunedCount: 0 };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    // Eligible terminal webhook events
    const baseQuery = {
      status: { $in: ['success', 'failed', 'rejected', 'ignored', 'duplicate'] },
      receivedAt: { $lt: cutoffDate },
      $or: [
        { claimExpiresAt: null },
        { claimExpiresAt: { $lt: now } },
      ],
    };

    if (options.workflowId) {
      baseQuery.workflow = options.workflowId;
    }

    // 1. Events WITHOUT eventIdentifier: Safe for complete deletion
    const deleteQuery = {
      ...baseQuery,
      $or: [
        { eventIdentifier: null },
        { eventIdentifier: '' },
      ],
    };

    const eligibleForDelete = await WebhookEvent.find(deleteQuery)
      .select('_id')
      .limit(batchSize)
      .lean();

    // 2. Events WITH eventIdentifier: Prune payloads to preserve deduplication index
    const pruneQuery = {
      ...baseQuery,
      eventIdentifier: { $type: 'string', $gt: '' },
      // Only prune if body or headers are not already pruned
      $or: [
        { body: { $ne: null } },
        { headers: { $ne: {} } },
      ],
    };

    const eligibleForPrune = await WebhookEvent.find(pruneQuery)
      .select('_id eventIdentifier')
      .limit(batchSize)
      .lean();

    // 3. Tier 2: Ancient deduplication stubs exceeding maximum replay protection threshold
    // Explicit policy: Only active when configured > 0, enforced at minimum 90 days to prevent replays
    const dedupRetentionDays = options.webhookDeduplicationRetentionDays !== undefined
      ? options.webhookDeduplicationRetentionDays
      : config.webhookDeduplicationRetentionDays;

    let eligibleForStubDelete = [];
    if (dedupRetentionDays > 0) {
      const safeDedupDays = Math.max(90, dedupRetentionDays);
      const cutoffDedupDate = new Date(now.getTime() - safeDedupDays * 24 * 60 * 60 * 1000);
      const stubDeleteQuery = {
        receivedAt: { $lt: cutoffDedupDate },
        eventIdentifier: { $type: 'string', $gt: '' },
      };
      if (options.workflowId) {
        stubDeleteQuery.workflow = options.workflowId;
      }
      eligibleForStubDelete = await WebhookEvent.find(stubDeleteQuery)
        .select('_id eventIdentifier')
        .limit(batchSize)
        .lean();
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        retentionDays,
        cutoffDate,
        eligibleDeleteCount: eligibleForDelete.length,
        eligiblePruneCount: eligibleForPrune.length,
        eligibleStubDeleteCount: eligibleForStubDelete.length,
        deletedCount: 0,
        prunedCount: 0,
        deletedStubsCount: 0,
      };
    }

    let deletedCount = 0;
    if (eligibleForDelete.length > 0) {
      const deleteIds = eligibleForDelete.map((e) => e._id);
      const res = await WebhookEvent.deleteMany({ _id: { $in: deleteIds } });
      deletedCount = res.deletedCount;
    }

    let prunedCount = 0;
    if (eligibleForPrune.length > 0) {
      const pruneIds = eligibleForPrune.map((e) => e._id);
      const res = await WebhookEvent.updateMany(
        { _id: { $in: pruneIds } },
        {
          $set: {
            body: null,
            headers: {},
            query: {},
            failureReason: 'Payload pruned per data retention policy',
          },
        }
      );
      prunedCount = res.modifiedCount;
    }

    let deletedStubsCount = 0;
    if (eligibleForStubDelete.length > 0) {
      const stubIds = eligibleForStubDelete.map((e) => e._id);
      const stubRes = await WebhookEvent.deleteMany({ _id: { $in: stubIds } });
      deletedStubsCount = stubRes.deletedCount;
    }

    return {
      success: true,
      dryRun: false,
      retentionDays,
      cutoffDate,
      deletedCount,
      prunedCount,
      deletedStubsCount,
    };
  }

  /**
   * Executes a complete retention sweep across all collections with distributed coordination.
   *
   * @param {object} [options={}] - Options { dryRun, batchSize }
   * @returns {Promise<object>}
   */
  async runRetentionCleanup(options = {}) {
    if (this._isRunning) {
      console.log('⚠ [DataRetention] Retention cleanup already running locally. Skipping overlap.');
      return { success: false, reason: 'already_running' };
    }

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return { success: false, reason: 'database_disconnected' };
    }

    const db = mongoose.connection.db;
    const workerId = process.env.WORKER_ID || `retention-${process.pid}-${Date.now()}`;
    const now = new Date();
    const lockTimeoutMs = 15 * 60 * 1000; // 15-minute lock duration
    const expiredCutoff = new Date(now.getTime() - lockTimeoutMs);

    let acquiredLock = false;
    let lockCollection = null;

    if (db) {
      try {
        lockCollection = db.collection('_retention_lock');
        const lockRes = await lockCollection.findOneAndUpdate(
          {
            _id: 'retention_lock',
            $or: [
              { locked: false },
              { locked: { $exists: false } },
              { lockedAt: { $lt: expiredCutoff } },
            ],
          },
          {
            $set: {
              locked: true,
              lockedAt: now,
              lockedBy: workerId,
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
        const doc = lockRes?.value || lockRes;
        if (doc && doc.lockedBy === workerId) {
          acquiredLock = true;
        } else {
          console.log(
            `ℹ [DataRetention] Another instance (${doc?.lockedBy || 'unknown'}) is currently running retention sweep. Skipping this turn.`
          );
          return { success: false, reason: 'locked_by_other_instance' };
        }
      } catch (lockErr) {
        console.warn(`[DataRetention] Distributed lock check warning: ${lockErr.message}`);
      }
    }

    this._isRunning = true;
    const startTime = Date.now();

    try {
      const execResult = await this.cleanExecutions(options);
      const webhookResult = await this.cleanWebhookEvents(options);

      const durationMs = Date.now() - startTime;
      console.log(
        `🧹 [DataRetention] Sweep completed in ${durationMs}ms: ` +
        `Executions deleted: ${execResult.deletedCount || 0}, ` +
        `Webhooks deleted: ${webhookResult.deletedCount || 0}, ` +
        `Webhooks pruned: ${webhookResult.prunedCount || 0}` +
        (webhookResult.deletedStubsCount ? `, Stubs expired: ${webhookResult.deletedStubsCount}` : '')
      );

      return {
        success: true,
        durationMs,
        executions: execResult,
        webhooks: webhookResult,
      };
    } finally {
      this._isRunning = false;
      if (acquiredLock && lockCollection) {
        try {
          await lockCollection.updateOne(
            { _id: 'retention_lock', lockedBy: workerId },
            { $set: { locked: false, lockedAt: null, lockedBy: null } }
          );
        } catch {
          // non-blocking
        }
      }
    }
  }

  /**
   * Starts periodic background retention cleanup worker.
   *
   * @param {number} [intervalMs]
   */
  startRetentionWorker(intervalMs) {
    const config = this.getConfig();
    if (!config.enabled) {
      console.log('ℹ [DataRetention] Worker disabled via DATA_RETENTION_ENABLED=false');
      return;
    }

    const interval = intervalMs || config.cleanupIntervalMs;
    this.stopRetentionWorker();

    console.log(`🛡 [DataRetention] Worker started (interval: ${(interval / 1000 / 60).toFixed(0)}m, ` +
      `Executions: ${config.executionRetentionDays}d, Webhooks: ${config.webhookEventRetentionDays}d)`);

    this._cleanupTimer = setInterval(() => {
      this.runRetentionCleanup().catch((err) => {
        console.error('❌ [DataRetention] Background cleanup error:', err.message);
      });
    }, interval);

    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Stops the background retention worker cleanly.
   */
  stopRetentionWorker() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
      console.log('✓ [DataRetention] Worker stopped');
    }
  }
}

// Singleton export
const dataRetentionService = new DataRetentionService();

module.exports = dataRetentionService;

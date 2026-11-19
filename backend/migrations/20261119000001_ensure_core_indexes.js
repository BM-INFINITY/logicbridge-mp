/**
 * Migration: ensure_core_indexes
 * Created at: 2026-11-19T00:00:01.000Z
 *
 * Verifies and builds critical compound indexes for high-throughput production queries,
 * lease recovery, and webhook deduplication.
 */

module.exports = {
  /**
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    const executions = db.collection('executions');
    await executions.createIndex({ workflow: 1, createdAt: -1 }, { name: 'idx_exec_workflow_created', background: true });
    await executions.createIndex({ owner: 1, status: 1 }, { name: 'idx_exec_owner_status', background: true });
    await executions.createIndex({ status: 1, leaseExpiresAt: 1 }, { name: 'idx_exec_status_lease', background: true });
    await executions.createIndex({ status: 1, 'approval.status': 1 }, { name: 'idx_exec_status_approval', background: true });
    await executions.createIndex({ status: 1, 'wait.status': 1 }, { name: 'idx_exec_status_wait', background: true });

    const webhookEvents = db.collection('webhookevents');
    await webhookEvents.createIndex(
      { workflow: 1, eventIdentifier: 1 },
      { name: 'idx_whevt_workflow_dedup', unique: true, sparse: true, background: true }
    );
    await webhookEvents.createIndex({ workflow: 1, createdAt: -1 }, { name: 'idx_whevt_workflow_created', background: true });

    const auditLogs = db.collection('auditlogs');
    await auditLogs.createIndex({ timestamp: -1 }, { name: 'idx_audit_timestamp', background: true });
    await auditLogs.createIndex({ userId: 1, timestamp: -1 }, { name: 'idx_audit_user_timestamp', background: true });
    await auditLogs.createIndex({ action: 1, timestamp: -1 }, { name: 'idx_audit_action_timestamp', background: true });
  },

  /**
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    const executions = db.collection('executions');
    try { await executions.dropIndex('idx_exec_workflow_created'); } catch (_) {
      try { await executions.dropIndex({ workflow: 1, createdAt: -1 }); } catch (__) {}
    }
    try { await executions.dropIndex('idx_exec_owner_status'); } catch (_) {
      try { await executions.dropIndex({ owner: 1, status: 1 }); } catch (__) {}
    }
    try { await executions.dropIndex('idx_exec_status_lease'); } catch (_) {
      try { await executions.dropIndex({ status: 1, leaseExpiresAt: 1 }); } catch (__) {}
    }
    try { await executions.dropIndex('idx_exec_status_approval'); } catch (_) {
      try { await executions.dropIndex({ status: 1, 'approval.status': 1 }); } catch (__) {}
    }
    try { await executions.dropIndex('idx_exec_status_wait'); } catch (_) {
      try { await executions.dropIndex({ status: 1, 'wait.status': 1 }); } catch (__) {}
    }

    const webhookEvents = db.collection('webhookevents');
    try { await webhookEvents.dropIndex('idx_whevt_workflow_dedup'); } catch (_) {
      try { await webhookEvents.dropIndex({ workflow: 1, eventIdentifier: 1 }); } catch (__) {}
    }
    try { await webhookEvents.dropIndex('idx_whevt_workflow_created'); } catch (_) {
      try { await webhookEvents.dropIndex({ workflow: 1, createdAt: -1 }); } catch (__) {}
    }

    const auditLogs = db.collection('auditlogs');
    try { await auditLogs.dropIndex('idx_audit_timestamp'); } catch (_) {
      try { await auditLogs.dropIndex({ timestamp: -1 }); } catch (__) {}
    }
    try { await auditLogs.dropIndex('idx_audit_user_timestamp'); } catch (_) {
      try { await auditLogs.dropIndex({ userId: 1, timestamp: -1 }); } catch (__) {}
    }
    try { await auditLogs.dropIndex('idx_audit_action_timestamp'); } catch (_) {
      try { await auditLogs.dropIndex({ action: 1, timestamp: -1 }); } catch (__) {}
    }
  },
};

/**
 * Migration: add_recovery_metadata
 * Created at: 2026-11-19T00:00:02.000Z
 *
 * Adds compound indexing for execution recovery status and ensures
 * legacy documents have the schema structure ready for operator diagnostics.
 */

module.exports = {
  /**
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    const executions = db.collection('executions');
    await executions.createIndex(
      { 'recovery.safeToAutoResume': 1, status: 1 },
      { name: 'idx_exec_recovery_safe_resume', background: true, sparse: true }
    );
  },

  /**
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    const executions = db.collection('executions');
    try {
      await executions.dropIndex('idx_exec_recovery_safe_resume');
    } catch (_) {
      try {
        await executions.dropIndex({ 'recovery.safeToAutoResume': 1, status: 1 });
      } catch (__) {}
    }
  },
};

/**
 * Migration: fix_resume_token_partial_indexes
 * Created at: 2026-11-19T00:00:03.000Z
 *
 * Replaces obsolete sparse unique indexes on approval.resumeToken, wait.resumeToken,
 * and occurrenceId with partial unique indexes restricted to string types.
 *
 * Root Cause Fix:
 * In MongoDB, a sparse unique index on a nested path like 'approval.resumeToken'
 * still indexes { 'approval.resumeToken': null } when the parent document contains
 * { approval: null }. This caused E11000 duplicate key collisions when creating
 * multiple normal executions that do not use approval or wait nodes.
 */

module.exports = {
  /**
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    const executions = db.collection('executions');
    let existingIndexes = [];
    try {
      existingIndexes = await executions.indexes();
    } catch (err) {
      // Collection may be empty/uninitialized
      existingIndexes = [];
    }

    // 1. Identify & drop obsolete sparse unique index on 'approval.resumeToken'
    const obsoleteApprovalIdx = existingIndexes.find(
      (idx) => idx.name === 'approval.resumeToken_1' || (idx.key && idx.key['approval.resumeToken'] && !idx.partialFilterExpression)
    );
    if (obsoleteApprovalIdx) {
      console.log(`[Migration] Dropping obsolete sparse index: ${obsoleteApprovalIdx.name}...`);
      try {
        await executions.dropIndex(obsoleteApprovalIdx.name);
      } catch (dropErr) {
        console.warn(`[Migration] Warning dropping ${obsoleteApprovalIdx.name}:`, dropErr.message);
      }
    }

    // 2. Identify & drop obsolete sparse unique index on 'wait.resumeToken'
    const obsoleteWaitIdx = existingIndexes.find(
      (idx) => idx.name === 'wait.resumeToken_1' || (idx.key && idx.key['wait.resumeToken'] && !idx.partialFilterExpression)
    );
    if (obsoleteWaitIdx) {
      console.log(`[Migration] Dropping obsolete sparse index: ${obsoleteWaitIdx.name}...`);
      try {
        await executions.dropIndex(obsoleteWaitIdx.name);
      } catch (dropErr) {
        console.warn(`[Migration] Warning dropping ${obsoleteWaitIdx.name}:`, dropErr.message);
      }
    }

    // 3. Identify & drop obsolete sparse unique index on 'occurrenceId'
    const obsoleteOccurrenceIdx = existingIndexes.find(
      (idx) => idx.name === 'occurrenceId_1' || (idx.key && idx.key['occurrenceId'] && !idx.partialFilterExpression)
    );
    if (obsoleteOccurrenceIdx) {
      console.log(`[Migration] Dropping obsolete sparse index: ${obsoleteOccurrenceIdx.name}...`);
      try {
        await executions.dropIndex(obsoleteOccurrenceIdx.name);
      } catch (dropErr) {
        console.warn(`[Migration] Warning dropping ${obsoleteOccurrenceIdx.name}:`, dropErr.message);
      }
    }

    // 4. Verify no duplicate non-null string tokens exist before building unique index
    try {
      const dupApprovals = await executions
        .aggregate([
          { $match: { 'approval.resumeToken': { $type: 'string' } } },
          { $group: { _id: '$approval.resumeToken', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      if (dupApprovals.length > 0) {
        console.warn(`[Migration] Warning: Detected ${dupApprovals.length} duplicate non-null approval resume tokens!`);
      }

      const dupWaits = await executions
        .aggregate([
          { $match: { 'wait.resumeToken': { $type: 'string' } } },
          { $group: { _id: '$wait.resumeToken', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      if (dupWaits.length > 0) {
        console.warn(`[Migration] Warning: Detected ${dupWaits.length} duplicate non-null wait resume tokens!`);
      }
    } catch (_) {
      // Non-blocking duplicate pre-check
    }

    // 5. Build safe partial unique indexes
    await executions.createIndex(
      { 'approval.resumeToken': 1 },
      {
        name: 'idx_approval_resume_token_unique',
        unique: true,
        partialFilterExpression: { 'approval.resumeToken': { $type: 'string' } },
        background: true,
      }
    );

    await executions.createIndex(
      { 'wait.resumeToken': 1 },
      {
        name: 'idx_wait_resume_token_unique',
        unique: true,
        partialFilterExpression: { 'wait.resumeToken': { $type: 'string' } },
        background: true,
      }
    );

    await executions.createIndex(
      { occurrenceId: 1 },
      {
        name: 'idx_occurrence_id_unique',
        unique: true,
        partialFilterExpression: { occurrenceId: { $type: 'string' } },
        background: true,
      }
    );
  },

  /**
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    const executions = db.collection('executions');
    try {
      await executions.dropIndex('idx_approval_resume_token_unique');
    } catch (_) {}
    try {
      await executions.dropIndex('idx_wait_resume_token_unique');
    } catch (_) {}
    try {
      await executions.dropIndex('idx_occurrence_id_unique');
    } catch (_) {}
  },
};

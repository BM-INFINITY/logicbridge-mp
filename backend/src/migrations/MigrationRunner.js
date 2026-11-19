const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

class MigrationRunner {
  /**
   * @param {object} [options={}]
   * @param {mongoose.Connection|object} [options.db] - Mongoose connection or native Mongo DB instance
   * @param {string} [options.migrationsDir] - Directory containing migration files
   * @param {string} [options.workerId] - Unique ID for distributed locking
   * @param {number} [options.lockTimeoutMs] - Lock expiration in ms (default 60000)
   */
  constructor(options = {}) {
    this.migrationsDir = options.migrationsDir || path.resolve(__dirname, '../../migrations');
    this.workerId = options.workerId || `runner-${process.pid}-${Date.now()}`;
    this.lockTimeoutMs = options.lockTimeoutMs || 60000;
    this._customDb = options.db || null;
  }

  /**
   * Resolves the active native MongoDB database instance
   * @returns {object} Native db
   */
  getDb() {
    if (this._customDb) {
      if (typeof this._customDb.collection === 'function') {
        return this._customDb;
      }
      if (this._customDb.db && typeof this._customDb.db.collection === 'function') {
        return this._customDb.db;
      }
    }
    if (mongoose.connection && mongoose.connection.db) {
      return mongoose.connection.db;
    }
    throw new Error('Database connection is not initialized. Please connect to MongoDB first.');
  }

  /**
   * Ensures migration metadata collections and indexes exist
   */
  async init() {
    const db = this.getDb();
    const migrationsCollection = db.collection('_migrations');
    await migrationsCollection.createIndex({ file: 1 }, { unique: true });

    const lockCollection = db.collection('_migration_lock');
    await lockCollection.createIndex({ _id: 1 });
  }

  /**
   * Acquires the distributed migration lock
   * @returns {Promise<boolean>}
   */
  async acquireLock() {
    const db = this.getDb();
    const lockCollection = db.collection('_migration_lock');
    const now = new Date();
    const expiredCutoff = new Date(now.getTime() - this.lockTimeoutMs);

    // Atomically acquire lock if not locked or if existing lock expired
    const result = await lockCollection.findOneAndUpdate(
      {
        _id: 'lock',
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
          lockedBy: this.workerId,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // In mongodb v4/v5/v6 returnDocument: 'after' or .value
    const doc = result?.value || result;
    if (doc && doc.lockedBy === this.workerId) {
      return true;
    }

    const currentLock = await lockCollection.findOne({ _id: 'lock' });
    throw new Error(
      `Migration lock is held by ${currentLock?.lockedBy || 'unknown'} since ${currentLock?.lockedAt?.toISOString() || 'recently'}`
    );
  }

  /**
   * Verifies that this runner instance still holds the distributed lock.
   * Prevents split-brain execution if a long-running step exceeded lockTimeoutMs.
   */
  async ensureLockOwner() {
    const db = this.getDb();
    const lockCollection = db.collection('_migration_lock');
    const currentLock = await lockCollection.findOne({ _id: 'lock' });
    if (!currentLock || !currentLock.locked || currentLock.lockedBy !== this.workerId) {
      throw new Error(
        `Migration lock was lost during execution! Current owner: "${currentLock?.lockedBy || 'none'}"`
      );
    }
  }

  /**
   * Releases the distributed migration lock
   */
  async releaseLock() {
    try {
      const db = this.getDb();
      const lockCollection = db.collection('_migration_lock');
      await lockCollection.updateOne(
        { _id: 'lock', lockedBy: this.workerId },
        {
          $set: {
            locked: false,
            lockedAt: null,
            lockedBy: null,
          },
        }
      );
    } catch (err) {
      console.warn(`[MigrationRunner] Failed to release lock: ${err.message}`);
    }
  }

  /**
   * Discovers migration files on disk sorted alphabetically
   * @returns {string[]}
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }
    return fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.js') && !file.startsWith('.'))
      .sort();
  }

  /**
   * Retrieves status of all migrations
   * @returns {Promise<Array<{ file: string, applied: boolean, appliedAt: Date|null, durationMs: number|null }>>}
   */
  async status() {
    await this.init();
    const db = this.getDb();
    const appliedDocs = await db.collection('_migrations').find({}).toArray();
    const appliedMap = new Map(appliedDocs.map((doc) => [doc.file, doc]));

    const files = this.getMigrationFiles();
    return files.map((file) => {
      const applied = appliedMap.get(file);
      return {
        file,
        applied: !!applied,
        appliedAt: applied ? applied.appliedAt : null,
        durationMs: applied ? applied.durationMs : null,
      };
    });
  }

  /**
   * Runs pending migrations up
   * @param {object} [options={}]
   * @param {string} [options.to] - Run up to specific migration file
   * @returns {Promise<string[]>} List of applied migration file names
   */
  async up(options = {}) {
    await this.init();
    await this.acquireLock();

    const appliedResults = [];
    try {
      const statuses = await this.status();
      const pending = statuses.filter((s) => !s.applied);

      if (pending.length === 0) {
        return appliedResults;
      }

      const db = this.getDb();
      const migrationsColl = db.collection('_migrations');

      for (const item of pending) {
        // Enforce lock ownership before each migration step
        await this.ensureLockOwner();

        const filePath = path.join(this.migrationsDir, item.file);
        const migration = require(filePath);

        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${item.file} does not export an up() function`);
        }

        const start = Date.now();
        console.log(`[MigrationRunner] Applying ${item.file}...`);
        await migration.up(db);
        const durationMs = Date.now() - start;

        await migrationsColl.insertOne({
          file: item.file,
          appliedAt: new Date(),
          durationMs,
        });

        appliedResults.push(item.file);
        console.log(`[MigrationRunner] Applied ${item.file} (${durationMs}ms)`);

        if (options.to && item.file === options.to) {
          break;
        }
      }

      return appliedResults;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Rolls back the last applied migration or down to specified target
   * @param {object} [options={}]
   * @param {string} [options.to] - Roll back down to target
   * @returns {Promise<string[]>} List of rolled back file names
   */
  async down(options = {}) {
    await this.init();
    await this.acquireLock();

    const rolledBack = [];
    try {
      const db = this.getDb();
      const migrationsColl = db.collection('_migrations');
      const appliedDocs = await migrationsColl.find({}).sort({ file: -1 }).toArray();

      if (appliedDocs.length === 0) {
        return rolledBack;
      }

      const targets = options.to
        ? appliedDocs.filter((d) => d.file >= options.to)
        : [appliedDocs[0]];

      for (const item of targets) {
        // Enforce lock ownership before each rollback step
        await this.ensureLockOwner();

        const filePath = path.join(this.migrationsDir, item.file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Migration file ${item.file} not found on disk for rollback`);
        }
        const migration = require(filePath);

        if (typeof migration.down !== 'function') {
          throw new Error(`Migration ${item.file} does not export a down() function`);
        }

        const start = Date.now();
        console.log(`[MigrationRunner] Rolling back ${item.file}...`);
        await migration.down(db);
        const durationMs = Date.now() - start;

        await migrationsColl.deleteOne({ file: item.file });
        rolledBack.push(item.file);
        console.log(`[MigrationRunner] Rolled back ${item.file} (${durationMs}ms)`);

        if (options.to && item.file === options.to) {
          break;
        }
      }

      return rolledBack;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Creates a new timestamped migration file template
   * @param {string} name
   * @returns {string} Path of created migration file
   */
  create(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Migration name is required');
    }
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14);
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}.js`;
    const filePath = path.join(this.migrationsDir, fileName);

    const template = `/**
 * Migration: ${sanitizedName}
 * Created at: ${new Date().toISOString()}
 */

module.exports = {
  /**
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    // Add forward migration logic here
  },

  /**
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    // Add rollback logic here
  },
};
`;

    fs.writeFileSync(filePath, template, 'utf8');
    return filePath;
  }
}

module.exports = MigrationRunner;

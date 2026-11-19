#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const MigrationRunner = require('./MigrationRunner');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logicbridge';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'create') {
    const name = args[1];
    if (!name) {
      console.error('Error: Please provide a name for the migration. Example: npm run migrate:create add_indexes');
      process.exit(1);
    }
    const runner = new MigrationRunner();
    const createdPath = runner.create(name);
    console.log(`Created migration: ${createdPath}`);
    process.exit(0);
  }

  // For database operations, connect via Mongoose
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (connErr) {
    console.error(`Failed to connect to MongoDB at ${MONGODB_URI}:`, connErr.message);
    process.exit(1);
  }

  const runner = new MigrationRunner({ db: mongoose.connection.db });

  try {
    switch (command) {
      case 'status': {
        const statuses = await runner.status();
        console.log('\n--- Migration Status ---');
        if (statuses.length === 0) {
          console.log('No migration files found.');
        } else {
          for (const s of statuses) {
            const badge = s.applied ? '[APPLIED]' : '[PENDING]';
            const dateStr = s.appliedAt ? ` (at ${new Date(s.appliedAt).toISOString()}, ${s.durationMs}ms)` : '';
            console.log(`${badge} ${s.file}${dateStr}`);
          }
        }
        console.log('------------------------\n');
        break;
      }

      case 'up': {
        const to = args[1] || null;
        console.log(`Running migrations up${to ? ` to ${to}` : ''}...`);
        const applied = await runner.up({ to });
        if (applied.length === 0) {
          console.log('Database is already up to date. No migrations to apply.');
        } else {
          console.log(`Successfully applied ${applied.length} migration(s):`, applied);
        }
        break;
      }

      case 'down': {
        const to = args[1] || null;
        console.log(`Rolling back migration(s)${to ? ` down to ${to}` : ''}...`);
        const rolledBack = await runner.down({ to });
        if (rolledBack.length === 0) {
          console.log('No applied migrations found to roll back.');
        } else {
          console.log(`Successfully rolled back ${rolledBack.length} migration(s):`, rolledBack);
        }
        break;
      }

      default:
        console.error(`Unknown command: "${command}". Available commands: status, up, down, create <name>`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Migration error:`, err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;

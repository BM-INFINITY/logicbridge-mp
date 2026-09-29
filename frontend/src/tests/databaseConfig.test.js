/**
 * Frontend Database Nodes Configuration & Validation Unit Tests
 * Covers: action-postgres and action-mongodb validation rules
 */

import NodeValidator from '../validators/NodeValidator.js';
import { NodeTypes } from '../constants/NodeTypes.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function main() {
  console.log('\n🧪 Starting Frontend Database Node Validation Unit Tests...\n');

  // ── Group 1: PostgreSQL Node Validation ────────────────────────────────────
  console.log('Group 1: PostgreSQL Node Validation');

  const validPgSelect = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'select', table: 'users', columns: '*' },
  };
  assert(NodeValidator.validateNode(validPgSelect).valid === true, 'Postgres: validates valid select');

  const missingConnPg = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { operation: 'select', table: 'users' },
  };
  assert(NodeValidator.validateNode(missingConnPg).valid === false, 'Postgres: rejects missing connection');

  const invalidOpPg = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'drop_database' },
  };
  assert(NodeValidator.validateNode(invalidOpPg).valid === false, 'Postgres: rejects invalid operation');

  const missingTablePg = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'select', table: '' },
  };
  assert(NodeValidator.validateNode(missingTablePg).valid === false, 'Postgres: rejects select with empty table');

  const validPgInsert = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'insert', table: 'users', values: '{"name": "Alice"}' },
  };
  assert(NodeValidator.validateNode(validPgInsert).valid === true, 'Postgres: validates insert with values');

  const missingInsertValues = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'insert', table: 'users', values: '' },
  };
  assert(NodeValidator.validateNode(missingInsertValues).valid === false, 'Postgres: rejects insert without values');

  const validPgUpdate = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'update', table: 'users', values: '{"role": "admin"}', filters: '{"id": "1"}' },
  };
  assert(NodeValidator.validateNode(validPgUpdate).valid === true, 'Postgres: validates update with values and filters');

  const missingUpdateFilters = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'update', table: 'users', values: '{"role": "admin"}', filters: '' },
  };
  assert(NodeValidator.validateNode(missingUpdateFilters).valid === false, 'Postgres: rejects update without filters');

  const missingDeleteFilters = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'delete', table: 'users', filters: '' },
  };
  assert(NodeValidator.validateNode(missingDeleteFilters).valid === false, 'Postgres: rejects delete without filters');

  const validPgRawSql = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'query', query: 'SELECT * FROM users' },
  };
  assert(NodeValidator.validateNode(validPgRawSql).valid === true, 'Postgres: validates raw SQL query');

  const missingPgRawSql = {
    type: NodeTypes.ACTION_POSTGRES,
    data: { connectionId: 'c1', operation: 'query', query: '' },
  };
  assert(NodeValidator.validateNode(missingPgRawSql).valid === false, 'Postgres: rejects empty raw SQL query');

  // ── Group 2: MongoDB Node Validation ───────────────────────────────────────
  console.log('\nGroup 2: MongoDB Node Validation');

  const validMongoFind = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'find', collection: 'users' },
  };
  assert(NodeValidator.validateNode(validMongoFind).valid === true, 'MongoDB: validates valid find');

  const missingConnMongo = {
    type: NodeTypes.ACTION_MONGODB,
    data: { operation: 'find', collection: 'users' },
  };
  assert(NodeValidator.validateNode(missingConnMongo).valid === false, 'MongoDB: rejects missing connection');

  const missingColMongo = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'find', collection: '' },
  };
  assert(NodeValidator.validateNode(missingColMongo).valid === false, 'MongoDB: rejects missing collection');

  const validMongoInsertOne = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'insertOne', collection: 'users', document: '{"name": "Alice"}' },
  };
  assert(NodeValidator.validateNode(validMongoInsertOne).valid === true, 'MongoDB: validates insertOne with document');

  const missingMongoInsertOneDoc = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'insertOne', collection: 'users', document: '' },
  };
  assert(NodeValidator.validateNode(missingMongoInsertOneDoc).valid === false, 'MongoDB: rejects insertOne without document');

  const validMongoUpdateOne = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'updateOne', collection: 'users', filter: '{"_id": "1"}', update: '{"status": "ok"}' },
  };
  assert(NodeValidator.validateNode(validMongoUpdateOne).valid === true, 'MongoDB: validates updateOne with filter and update');

  const missingMongoUpdateFilter = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'updateOne', collection: 'users', filter: '', update: '{"status": "ok"}' },
  };
  assert(NodeValidator.validateNode(missingMongoUpdateFilter).valid === false, 'MongoDB: rejects updateOne without filter');

  const missingMongoDeleteFilter = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'deleteOne', collection: 'users', filter: '' },
  };
  assert(NodeValidator.validateNode(missingMongoDeleteFilter).valid === false, 'MongoDB: rejects deleteOne without filter');

  const validMongoCount = {
    type: NodeTypes.ACTION_MONGODB,
    data: { connectionId: 'c1', operation: 'count', collection: 'users' },
  };
  assert(NodeValidator.validateNode(validMongoCount).valid === true, 'MongoDB: validates count operation');

  console.log(`\n${passed} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();

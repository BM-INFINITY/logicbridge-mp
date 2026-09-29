/**
 * MongoNode Backend Unit Tests
 * Covers: Find, Find One, Insert One, Insert Many, Update One, Delete One, Count,
 *         Validation, Variable Resolution, ObjectId Handling, Security/Credential Redaction, Connection Failure
 */

const MongoNode = require('../nodes/MongoNode');
const ExecutionContext = require('../utils/ExecutionContext');
const ConnectionService = require('../services/ConnectionService');
const { ObjectId } = require('mongodb');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting MongoNode Unit Tests...\n');
  const mongoNode = new MongoNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-fail') {
      throw new Error('Connection failed at mongodb://admin:secretPass123@cluster.example.com/mydb');
    }
    return {
      connectionString: 'mongodb://admin:secretPass123@localhost:27017/mydb',
      database: 'mydb',
    };
  };

  // Helper mock MongoDB client & collection
  function createMockMongoClient(colMocks = {}) {
    return {
      connected: false,
      closed: false,
      async connect() {
        this.connected = true;
      },
      db(dbName) {
        return {
          databaseName: dbName,
          collection(colName) {
            return {
              collectionName: colName,
              find(filter) {
                let limitVal = 100;
                let sortVal = null;
                const cursor = {
                  limit(l) {
                    limitVal = l;
                    return cursor;
                  },
                  sort(s) {
                    sortVal = s;
                    return cursor;
                  },
                  async toArray() {
                    if (colMocks.find) return colMocks.find(filter, { limit: limitVal, sort: sortVal });
                    return [{ _id: '1', item: 'Sample' }];
                  },
                };
                return cursor;
              },
              async findOne(filter) {
                if (colMocks.findOne) return colMocks.findOne(filter);
                return { _id: '1', item: 'Sample' };
              },
              async insertOne(doc) {
                if (colMocks.insertOne) return colMocks.insertOne(doc);
                return { insertedId: new ObjectId(), acknowledged: true };
              },
              async insertMany(docs) {
                if (colMocks.insertMany) return colMocks.insertMany(docs);
                return { insertedCount: docs.length, insertedIds: {}, acknowledged: true };
              },
              async updateOne(filter, update) {
                if (colMocks.updateOne) return colMocks.updateOne(filter, update);
                return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
              },
              async deleteOne(filter) {
                if (colMocks.deleteOne) return colMocks.deleteOne(filter);
                return { deletedCount: 1, acknowledged: true };
              },
              async countDocuments(filter) {
                if (colMocks.countDocuments) return colMocks.countDocuments(filter);
                return 42;
              },
            };
          },
        };
      },
      async close() {
        this.closed = true;
      },
    };
  }

  const ctx = new ExecutionContext({
    initialResults: {
      step_1: { email: 'user@example.com', amount: 150 },
    },
  });
  ctx.lastOutput = { id: '507f1f77bcf86cd799439011', role: 'admin' };

  try {
    // ── Group 1: Validation ───────────────────────────────────────────────────
    console.log('Group 1: Validation');

    check(!mongoNode.validate({ data: {} }).valid, 'Rejects missing connectionId');
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'invalid' } }).valid,
      'Rejects invalid operation'
    );
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'find', collection: '' } }).valid,
      'Rejects missing collection name'
    );
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'insertOne', collection: 'users', document: {} } }).valid,
      'Rejects insertOne without document'
    );
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'insertMany', collection: 'users', document: [] } }).valid,
      'Rejects insertMany without documents'
    );
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'updateOne', collection: 'users', filter: {}, update: { a: 1 } } }).valid,
      'Rejects updateOne without filter'
    );
    check(
      !mongoNode.validate({ data: { connectionId: 'c1', operation: 'deleteOne', collection: 'users', filter: {} } }).valid,
      'Rejects deleteOne without filter'
    );
    check(
      mongoNode.validate({ data: { connectionId: 'c1', operation: 'find', collection: 'orders' } }).valid,
      'Accepts valid find configuration'
    );

    // ── Group 2: Find Operation ───────────────────────────────────────────────
    console.log('\nGroup 2: Find Operation');

    let capturedFilter = null;
    let capturedOptions = null;

    const mockFindClient = createMockMongoClient({
      find: (filter, opts) => {
        capturedFilter = filter;
        capturedOptions = opts;
        return [
          { _id: '1', role: 'admin', active: true },
          { _id: '2', role: 'admin', active: true },
        ];
      },
    });

    const findRes = await mongoNode.execute(
      {
        id: 'mongo_find',
        data: {
          connectionId: 'c1',
          operation: 'find',
          collection: 'users',
          filter: { role: '{{prev.role}}', active: true },
          limit: '25',
          sort: { createdAt: -1 },
        },
      },
      { ...ctx, _mongoClient: mockFindClient }
    );

    check(findRes.operation === 'find', 'Find: operation is "find"');
    check(findRes.count === 2, 'Find: returned count matches');
    check(Array.isArray(findRes.documents) && findRes.documents.length === 2, 'Find: documents returned as array');
    check(capturedFilter.role === 'admin' && capturedFilter.active === true, 'Find: filter variables resolved');
    check(capturedOptions.limit === 25, 'Find: limit option passed');
    check(capturedOptions.sort.createdAt === -1, 'Find: sort option passed');

    // ── Group 3: Find One Operation ───────────────────────────────────────────
    console.log('\nGroup 3: Find One Operation');

    const mockFindOneClient = createMockMongoClient({
      findOne: (filter) => {
        capturedFilter = filter;
        return { _id: filter._id, email: 'user@example.com' };
      },
    });

    const findOneRes = await mongoNode.execute(
      {
        id: 'mongo_find_one',
        data: {
          connectionId: 'c1',
          operation: 'findOne',
          collection: 'users',
          filter: { _id: '{{prev.id}}' },
        },
      },
      { ...ctx, _mongoClient: mockFindOneClient }
    );

    check(findOneRes.operation === 'findOne', 'FindOne: operation set');
    check(findOneRes.found === true, 'FindOne: found flag true');
    check(capturedFilter._id instanceof ObjectId, 'FindOne: 24-hex string normalized to ObjectId');
    check(capturedFilter._id.toString() === '507f1f77bcf86cd799439011', 'FindOne: ObjectId value matches prev.id');

    // ── Group 4: Insert Operations ────────────────────────────────────────────
    console.log('\nGroup 4: Insert Operations');

    let capturedDoc = null;
    const testId = new ObjectId();
    const mockInsertClient = createMockMongoClient({
      insertOne: (doc) => {
        capturedDoc = doc;
        return { insertedId: testId, acknowledged: true };
      },
      insertMany: (docs) => {
        capturedDoc = docs;
        return { insertedCount: docs.length, insertedIds: { 0: new ObjectId(), 1: new ObjectId() }, acknowledged: true };
      },
    });

    const insertOneRes = await mongoNode.execute(
      {
        id: 'mongo_insert_one',
        data: {
          connectionId: 'c1',
          operation: 'insertOne',
          collection: 'audit_logs',
          document: {
            actor: '{{prev.role}}',
            email: '{{steps.step_1.email}}',
            timestamp: '2025-01-01',
          },
        },
      },
      { ...ctx, _mongoClient: mockInsertClient }
    );

    check(insertOneRes.operation === 'insertOne', 'InsertOne: operation set');
    check(insertOneRes.acknowledged === true, 'InsertOne: acknowledged true');
    check(capturedDoc.actor === 'admin', 'InsertOne: prev variable resolved in document');
    check(capturedDoc.email === 'user@example.com', 'InsertOne: step variable resolved in document');

    const insertManyRes = await mongoNode.execute(
      {
        id: 'mongo_insert_many',
        data: {
          connectionId: 'c1',
          operation: 'insertMany',
          collection: 'events',
          document: [
            { event: 'login', email: '{{steps.step_1.email}}' },
            { event: 'purchase', amount: '{{steps.step_1.amount}}' },
          ],
        },
      },
      { ...ctx, _mongoClient: mockInsertClient }
    );

    check(insertManyRes.operation === 'insertMany', 'InsertMany: operation set');
    check(insertManyRes.insertedCount === 2, 'InsertMany: insertedCount matches');
    check(capturedDoc[0].email === 'user@example.com', 'InsertMany: resolves array items');

    // ── Group 5: Update One Operation ─────────────────────────────────────────
    console.log('\nGroup 5: Update One Operation');

    let capturedUpdate = null;
    const mockUpdateClient = createMockMongoClient({
      updateOne: (filter, update) => {
        capturedFilter = filter;
        capturedUpdate = update;
        return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
      },
    });

    const updateRes = await mongoNode.execute(
      {
        id: 'mongo_update_one',
        data: {
          connectionId: 'c1',
          operation: 'updateOne',
          collection: 'users',
          filter: { email: '{{steps.step_1.email}}' },
          update: { status: 'verified', role: '{{prev.role}}' },
        },
      },
      { ...ctx, _mongoClient: mockUpdateClient }
    );

    check(updateRes.operation === 'updateOne', 'UpdateOne: operation set');
    check(updateRes.matchedCount === 1, 'UpdateOne: matchedCount returned');
    check(updateRes.modifiedCount === 1, 'UpdateOne: modifiedCount returned');
    check(capturedFilter.email === 'user@example.com', 'UpdateOne: filter variable resolved');
    check(capturedUpdate.$set !== undefined, 'UpdateOne: auto-wraps plain object in $set');
    check(capturedUpdate.$set.status === 'verified', 'UpdateOne: update field preserved');
    check(capturedUpdate.$set.role === 'admin', 'UpdateOne: variable resolved in update data');

    // ── Group 6: Delete One & Count Operations ────────────────────────────────
    console.log('\nGroup 6: Delete One & Count Operations');

    const mockDeleteClient = createMockMongoClient({
      deleteOne: (filter) => {
        capturedFilter = filter;
        return { deletedCount: 1, acknowledged: true };
      },
      countDocuments: (filter) => {
        capturedFilter = filter;
        return 77;
      },
    });

    const deleteRes = await mongoNode.execute(
      {
        id: 'mongo_delete',
        data: {
          connectionId: 'c1',
          operation: 'deleteOne',
          collection: 'sessions',
          filter: { userId: '{{prev.id}}' },
        },
      },
      { ...ctx, _mongoClient: mockDeleteClient }
    );

    check(deleteRes.operation === 'deleteOne', 'DeleteOne: operation set');
    check(deleteRes.deletedCount === 1, 'DeleteOne: deletedCount returned');

    const countRes = await mongoNode.execute(
      {
        id: 'mongo_count',
        data: {
          connectionId: 'c1',
          operation: 'count',
          collection: 'sessions',
          filter: { active: true },
        },
      },
      { ...ctx, _mongoClient: mockDeleteClient }
    );

    check(countRes.operation === 'count', 'Count: operation set');
    check(countRes.count === 77, 'Count: countDocuments result returned');

    // ── Group 7: Security & Connection Failure ────────────────────────────────
    console.log('\nGroup 7: Security & Connection Failure');

    let connectionFailureCaught = false;
    try {
      await mongoNode.execute(
        {
          id: 'mongo_fail',
          data: {
            connectionId: 'conn-fail',
            operation: 'find',
            collection: 'users',
          },
        },
        ctx
      );
    } catch (err) {
      connectionFailureCaught = true;
      check(!err.message.includes('secretPass123'), 'Connection Failure: password redacted from error message');
      check(err.message.includes('[REDACTED]'), 'Connection Failure: URI password replaced with [REDACTED]');
    }
    check(connectionFailureCaught, 'Connection Failure: throws NodeExecutionError');

  } finally {
    ConnectionService.getDecryptedCredentials = originalGetCreds;
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

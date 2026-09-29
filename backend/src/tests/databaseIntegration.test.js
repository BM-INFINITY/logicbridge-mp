/**
 * Integration Tests — Database Nodes
 * Covers:
 *   - Database → Transform
 *   - Database → Condition
 *   - Database → HTTP
 *   - HTTP → Database
 *   - Workflow Serialization & Deserialization (Import/Export)
 *   - Replay / Execution Step Redaction
 */

const PostgresNode = require('../nodes/PostgresNode');
const MongoNode = require('../nodes/MongoNode');
const TransformNode = require('../nodes/TransformNode');
const ConditionNode = require('../nodes/ConditionNode');
const HttpNode = require('../nodes/HttpNode');
const ExecutionContext = require('../utils/ExecutionContext');
const WorkflowSerializer = require('../services/WorkflowSerializer');
const ConnectionService = require('../services/ConnectionService');
const { redactSecrets } = require('../utils/SecretRedactor');

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
  console.log('\n🧪 Starting Database Integration Tests...\n');

  const pgNode = new PostgresNode();
  const mongoNode = new MongoNode();
  const transform = new TransformNode();
  const condition = new ConditionNode();
  const http = new HttpNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async () => ({
    host: 'localhost',
    port: 5432,
    database: 'analytics',
    user: 'app_user',
    password: 'supersecretpassword123',
    connectionString: 'mongodb://app_user:supersecretpassword123@localhost:27017/analytics',
  });

  try {
    // ── Chain 1: Database → Transform ─────────────────────────────────────────
    console.log('Chain 1: Database → Transform');

    const ctx1 = new ExecutionContext();
    const mockPgClient1 = {
      async connect() {},
      async query() {
        return {
          rows: [
            { id: 101, username: 'charlie', score: 98, role: 'admin' },
            { id: 102, username: 'dana', score: 85, role: 'user' },
          ],
          rowCount: 2,
        };
      },
      async end() {},
    };

    const pgRes1 = await pgNode.execute(
      {
        id: 'pg_users',
        data: {
          connectionId: 'conn_pg',
          operation: 'select',
          table: 'users',
          columns: 'id, username, score, role',
        },
      },
      { ...ctx1, _pgClient: mockPgClient1 }
    );
    ctx1.setResult('pg_users', pgRes1);

    check(pgRes1.rowCount === 2, 'PG: Select returned 2 rows');

    const transformRes1 = await transform.execute(
      {
        id: 'transform_1',
        data: {
          operation: 'map',
          mappings: [
            { outputField: 'topUser', source: '{{prev.rows.0.username}}' },
            { outputField: 'topScore', source: '{{prev.rows.0.score}}' },
          ],
        },
      },
      ctx1
    );
    ctx1.setResult('transform_1', transformRes1);

    check(transformRes1.data.topUser === 'charlie', 'Transform: topUser mapped from PG rows[0]');
    check(Number(transformRes1.data.topScore) === 98, 'Transform: topScore mapped from PG rows[0]');

    // ── Chain 2: Database → Condition ─────────────────────────────────────────
    console.log('\nChain 2: Database → Condition');

    const ctx2 = new ExecutionContext();
    const mockMongoClient2 = {
      async connect() {},
      db() {
        return {
          collection() {
            return {
              async countDocuments() {
                return 15;
              },
            };
          },
        };
      },
      async close() {},
    };

    const mongoRes2 = await mongoNode.execute(
      {
        id: 'mongo_count',
        data: {
          connectionId: 'conn_mongo',
          operation: 'count',
          collection: 'pending_tasks',
        },
      },
      { ...ctx2, _mongoClient: mockMongoClient2 }
    );
    ctx2.setResult('mongo_count', mongoRes2);

    check(mongoRes2.count === 15, 'Mongo: Count returned 15');

    const conditionRes2 = await condition.execute(
      {
        id: 'cond_1',
        data: {
          leftValue: '{{prev.count}}',
          operator: 'greater-than',
          rightValue: '10',
        },
      },
      ctx2
    );

    check(conditionRes2.branch === 'true', 'Condition: branched to true because count 15 > 10');
    check(conditionRes2.passed === true, 'Condition: evaluated true for database count');

    // ── Chain 3: Database → HTTP ──────────────────────────────────────────────
    console.log('\nChain 3: Database → HTTP');

    const ctx3 = new ExecutionContext();
    const mockPgClient3 = {
      async connect() {},
      async query() {
        return {
          rows: [{ id: 55, apiEndpoint: 'https://jsonplaceholder.typicode.com/posts/1' }],
          rowCount: 1,
        };
      },
      async end() {},
    };

    const pgRes3 = await pgNode.execute(
      {
        id: 'pg_config',
        data: {
          connectionId: 'conn_pg',
          operation: 'select',
          table: 'settings',
        },
      },
      { ...ctx3, _pgClient: mockPgClient3 }
    );
    ctx3.setResult('pg_config', pgRes3);

    const httpRes3 = await http.execute(
      {
        id: 'http_fetch',
        data: {
          url: '{{prev.rows.0.apiEndpoint}}',
          method: 'GET',
        },
      },
      ctx3
    );
    ctx3.setResult('http_fetch', httpRes3);

    check(httpRes3.status === 200, 'HTTP: GET request succeeded using URL resolved from Database');
    check(httpRes3.data && httpRes3.data.id === 1, 'HTTP: response data parsed correctly');

    // ── Chain 4: HTTP → Database ──────────────────────────────────────────────
    console.log('\nChain 4: HTTP → Database');

    const ctx4 = new ExecutionContext();
    const httpRes4 = await http.execute(
      {
        id: 'http_order',
        data: {
          url: 'https://jsonplaceholder.typicode.com/users/1',
          method: 'GET',
        },
      },
      ctx4
    );
    ctx4.setResult('http_order', httpRes4);

    check(httpRes4.status === 200, 'HTTP: fetched user payload');

    let insertedDoc = null;
    const mockMongoClient4 = {
      async connect() {},
      db() {
        return {
          collection() {
            return {
              async insertOne(doc) {
                insertedDoc = doc;
                return { insertedId: 'new_id_123', acknowledged: true };
              },
            };
          },
        };
      },
      async close() {},
    };

    const mongoRes4 = await mongoNode.execute(
      {
        id: 'mongo_save',
        data: {
          connectionId: 'conn_mongo',
          operation: 'insertOne',
          collection: 'synced_users',
          document: {
            externalId: '{{prev.data.id}}',
            externalName: '{{prev.data.name}}',
            syncedEmail: '{{prev.data.email}}',
          },
        },
      },
      { ...ctx4, _mongoClient: mockMongoClient4 }
    );

    check(mongoRes4.operation === 'insertOne', 'Mongo: insertOne succeeded');
    check(insertedDoc.externalName === 'Leanne Graham', 'Mongo: inserted document name resolved from HTTP output');
    check(insertedDoc.syncedEmail === 'Sincere@april.biz', 'Mongo: inserted document email resolved from HTTP output');

    // ── Chain 5: Serialization & Deserialization ──────────────────────────────
    console.log('\nChain 5: Serialization & Deserialization');

    const testWorkflow = {
      name: 'Database Pipeline Workflow',
      description: 'Pipeline with Postgres and MongoDB',
      nodes: [
        {
          id: 'n_pg',
          type: 'action-postgres',
          position: { x: 100, y: 100 },
          data: { connectionId: 'c_pg', operation: 'select', table: 'orders' },
        },
        {
          id: 'n_mongo',
          type: 'action-mongodb',
          position: { x: 300, y: 100 },
          data: { connectionId: 'c_mongo', operation: 'find', collection: 'logs' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_pg', target: 'n_mongo' },
      ],
    };

    const serializedPackage = WorkflowSerializer.serialize(testWorkflow);
    check(serializedPackage.manifest !== undefined, 'Serializer: manifest created');
    check(serializedPackage.statistics.nodeCount === 2, 'Serializer: node count is 2');
    check(serializedPackage.workflow.nodes.length === 2, 'Serializer: 2 nodes serialized');

    const deserialized = WorkflowSerializer.deserialize(serializedPackage);
    check(deserialized.name === 'Database Pipeline Workflow', 'Deserializer: name preserved');
    check(deserialized.nodes.length === 2, 'Deserializer: nodes restored');
    check(deserialized.nodes[0].type === 'action-postgres', 'Deserializer: action-postgres preserved');
    check(deserialized.nodes[1].type === 'action-mongodb', 'Deserializer: action-mongodb preserved');

    // ── Chain 6: Security & Replay Redaction ──────────────────────────────────
    console.log('\nChain 6: Security & Replay Redaction');

    const mockExecutionRecord = {
      stepId: 'step_pg',
      nodeType: 'action-postgres',
      input: {
        connectionId: 'c1',
        password: 'should_be_hidden',
        connectionString: 'postgresql://admin:secretPass@localhost:5432/db',
      },
      output: {
        rows: [{ id: 1 }],
      },
    };

    const redactedRecord = redactSecrets(mockExecutionRecord);
    check(redactedRecord.input.password === '[REDACTED]', 'Replay: step password redacted');
    check(redactedRecord.input.connectionString.includes('[REDACTED]'), 'Replay: connection URI credentials redacted');
    check(!redactedRecord.input.connectionString.includes('secretPass'), 'Replay: secretPass removed completely');

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

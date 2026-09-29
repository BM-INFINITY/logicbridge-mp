/**
 * PostgresNode Backend Unit Tests
 * Covers: Select, Insert, Update, Delete, Raw SQL, Parameters,
 *         Validation, Security/SQL injection prevention, Credential Redaction, Connection Failure
 */

const assert = require('assert');
const PostgresNode = require('../nodes/PostgresNode');
const ExecutionContext = require('../utils/ExecutionContext');
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
  console.log('\n🧪 Starting PostgresNode Unit Tests...\n');
  const pgNode = new PostgresNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-fail') {
      throw new Error('Connection refused at 127.0.0.1:5432 with password=supersecretpassword123');
    }
    return {
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'postgres',
      password: 'supersecretpassword123',
    };
  };

  // Helper mock client
  function createMockClient(mockQueryFn) {
    return {
      connected: false,
      ended: false,
      async connect() {
        this.connected = true;
      },
      async query(sql, params) {
        return mockQueryFn(sql, params);
      },
      async end() {
        this.ended = true;
      },
    };
  }

  try {
    // ── Group 1: Validation ───────────────────────────────────────────────────
    console.log('Group 1: Validation');

    check(!pgNode.validate({ data: {} }).valid, 'Rejects missing connectionId');
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'unknown' } }).valid,
      'Rejects unknown operation'
    );
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'select', table: '' } }).valid,
      'Rejects select without table'
    );
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'insert', table: 'users', values: {} } }).valid,
      'Rejects insert without values'
    );
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'update', table: 'users', values: { a: 1 }, filters: {} } }).valid,
      'Rejects update without filters'
    );
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'delete', table: 'users', filters: {} } }).valid,
      'Rejects delete without filters'
    );
    check(
      !pgNode.validate({ data: { connectionId: 'c1', operation: 'query', query: '' } }).valid,
      'Rejects raw SQL without query text'
    );
    check(
      pgNode.validate({ data: { connectionId: 'c1', operation: 'select', table: 'users' } }).valid,
      'Accepts valid select config'
    );

    // ── Group 2: Select Operation ─────────────────────────────────────────────
    console.log('\nGroup 2: Select Operation');

    let executedSql = '';
    let executedParams = [];

    const mockSelectClient = createMockClient((sql, params) => {
      executedSql = sql;
      executedParams = params;
      return {
        rows: [{ id: 1, name: 'Alice', status: 'active' }],
        rowCount: 1,
      };
    });

    const ctx = new ExecutionContext({
      initialResults: {
        node_1: { email: 'alice@example.com' },
      },
    });
    ctx.lastOutput = { id: 42 };

    const selectRes = await pgNode.execute(
      {
        id: 'pg_1',
        data: {
          connectionId: 'c1',
          operation: 'select',
          table: 'users',
          columns: 'id, name, status',
          filters: { status: 'active', id: '{{prev.id}}' },
          limit: '5',
        },
      },
      { ...ctx, _pgClient: mockSelectClient }
    );

    check(selectRes.rowCount === 1, 'Select: rowCount returned correctly');
    check(Array.isArray(selectRes.rows) && selectRes.rows.length === 1, 'Select: rows returned as array');
    check(selectRes.operation === 'select', 'Select: operation field set');
    check(executedSql.includes('SELECT "id", "name", "status" FROM "users"'), 'Select: columns & table quoted');
    check(executedSql.includes('"status" = $1 AND "id" = $2'), 'Select: WHERE clause parameterized with $1 and $2');
    check(executedSql.includes('LIMIT $3'), 'Select: LIMIT parameterized with $3');
    check(executedParams[0] === 'active' && String(executedParams[1]) === '42' && executedParams[2] === 5, 'Select: parameters safely bound');

    // ── Group 3: Insert Operation ─────────────────────────────────────────────
    console.log('\nGroup 3: Insert Operation');

    const mockInsertClient = createMockClient((sql, params) => {
      executedSql = sql;
      executedParams = params;
      return {
        rows: [{ id: 101, name: 'Bob', email: params[1] }],
        rowCount: 1,
      };
    });

    const insertRes = await pgNode.execute(
      {
        id: 'pg_insert',
        data: {
          connectionId: 'c1',
          operation: 'insert',
          table: 'customers',
          values: {
            name: 'Bob',
            email: '{{steps.node_1.email}}',
          },
        },
      },
      { ...ctx, _pgClient: mockInsertClient }
    );

    check(insertRes.rowCount === 1, 'Insert: rowCount returned');
    check(insertRes.rows[0].id === 101, 'Insert: returned row returned');
    check(executedSql.startsWith('INSERT INTO "customers"'), 'Insert: table quoted safely');
    check(executedSql.includes('RETURNING *'), 'Insert: includes RETURNING *');
    check(executedParams[0] === 'Bob' && executedParams[1] === 'alice@example.com', 'Insert: variables resolved into params');

    // ── Group 4: Update Operation ─────────────────────────────────────────────
    console.log('\nGroup 4: Update Operation');

    const mockUpdateClient = createMockClient((sql, params) => {
      executedSql = sql;
      executedParams = params;
      return {
        rows: [{ id: 42, status: 'verified' }],
        rowCount: 1,
      };
    });

    const updateRes = await pgNode.execute(
      {
        id: 'pg_update',
        data: {
          connectionId: 'c1',
          operation: 'update',
          table: 'users',
          values: { status: 'verified' },
          filters: { id: '{{prev.id}}' },
        },
      },
      { ...ctx, _pgClient: mockUpdateClient }
    );

    check(updateRes.rowCount === 1, 'Update: rowCount returned');
    check(executedSql.startsWith('UPDATE "users" SET "status" = $1 WHERE "id" = $2'), 'Update: SET and WHERE parameterized');
    check(executedParams[0] === 'verified' && String(executedParams[1]) === '42', 'Update: parameters bound');

    // ── Group 5: Delete Operation ─────────────────────────────────────────────
    console.log('\nGroup 5: Delete Operation');

    const mockDeleteClient = createMockClient((sql, params) => {
      executedSql = sql;
      executedParams = params;
      return {
        rows: [{ id: 42 }],
        rowCount: 1,
      };
    });

    const deleteRes = await pgNode.execute(
      {
        id: 'pg_delete',
        data: {
          connectionId: 'c1',
          operation: 'delete',
          table: 'users',
          filters: { id: '{{prev.id}}' },
        },
      },
      { ...ctx, _pgClient: mockDeleteClient }
    );

    check(deleteRes.rowCount === 1, 'Delete: rowCount returned');
    check(executedSql === 'DELETE FROM "users" WHERE "id" = $1 RETURNING *', 'Delete: query correctly generated');
    check(String(executedParams[0]) === '42', 'Delete: parameter bound');

    // ── Group 6: Raw SQL & Parameterization ───────────────────────────────────
    console.log('\nGroup 6: Raw SQL & Parameterization');

    const mockRawClient = createMockClient((sql, params) => {
      executedSql = sql;
      executedParams = params;
      return {
        rows: [{ total: 100 }],
        rowCount: 1,
      };
    });

    // Case A: Mustache variables in query string converted to parameters
    await pgNode.execute(
      {
        id: 'pg_raw_mustache',
        data: {
          connectionId: 'c1',
          operation: 'query',
          query: 'SELECT * FROM orders WHERE user_id = {{prev.id}} AND email = {{steps.node_1.email}}',
        },
      },
      { ...ctx, _pgClient: mockRawClient }
    );

    check(executedSql === 'SELECT * FROM orders WHERE user_id = $1 AND email = $2', 'Raw SQL: mustache placeholders converted to $1, $2');
    check(executedParams[0] === '42' && executedParams[1] === 'alice@example.com', 'Raw SQL: mustache values extracted into params array');

    // Case B: Explicit params array
    await pgNode.execute(
      {
        id: 'pg_raw_explicit',
        data: {
          connectionId: 'c1',
          operation: 'query',
          query: 'SELECT * FROM orders WHERE status = $1',
          params: ['active'],
        },
      },
      { ...ctx, _pgClient: mockRawClient }
    );

    check(executedSql === 'SELECT * FROM orders WHERE status = $1', 'Raw SQL: explicit $1 query preserved');
    check(executedParams[0] === 'active', 'Raw SQL: explicit parameter passed');

    // ── Group 7: Security & SQL Injection Prevention ──────────────────────────
    console.log('\nGroup 7: Security & SQL Injection Prevention');

    let injectionBlocked = false;
    try {
      await pgNode.execute(
        {
          id: 'pg_inject_table',
          data: {
            connectionId: 'c1',
            operation: 'select',
            table: 'users; DROP TABLE users;--',
          },
        },
        { ...ctx, _pgClient: mockSelectClient }
      );
    } catch (err) {
      injectionBlocked = err.message.includes('Invalid Table name');
    }
    check(injectionBlocked, 'SQL Injection: malicious table name rejected');

    let columnInjectionBlocked = false;
    try {
      await pgNode.execute(
        {
          id: 'pg_inject_col',
          data: {
            connectionId: 'c1',
            operation: 'select',
            table: 'users',
            columns: 'id, (SELECT password FROM secret_table)',
          },
        },
        { ...ctx, _pgClient: mockSelectClient }
      );
    } catch (err) {
      columnInjectionBlocked = err.message.includes('Invalid Column');
    }
    check(columnInjectionBlocked, 'SQL Injection: malicious column identifier rejected');

    // ── Group 8: Secret Redaction & Connection Failure ────────────────────────
    console.log('\nGroup 8: Secret Redaction & Connection Failure');

    let connectionFailureHandled = false;
    try {
      await pgNode.execute(
        {
          id: 'pg_fail',
          data: {
            connectionId: 'conn-fail',
            operation: 'select',
            table: 'users',
          },
        },
        ctx
      );
    } catch (err) {
      connectionFailureHandled = true;
      check(!err.message.includes('supersecretpassword123'), 'Connection Failure: password redacted from error message');
    }
    check(connectionFailureHandled, 'Connection Failure: throws clear error');

    // Verify secret redactor
    const sensitiveObj = {
      user: 'postgres',
      password: 'supersecretpassword123',
      connectionString: 'postgresql://postgres:secret123@localhost:5432/mydb',
      database: 'mydb',
    };
    const redacted = redactSecrets(sensitiveObj);
    check(redacted.password === '[REDACTED]', 'SecretRedactor: password field redacted');
    check(redacted.connectionString.includes('[REDACTED]'), 'SecretRedactor: connection URI password redacted');
    check(!redacted.connectionString.includes('secret123'), 'SecretRedactor: raw password purged from URI');

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

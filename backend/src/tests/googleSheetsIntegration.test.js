/**
 * Integration Tests — Google Sheets Node Chains
 * Covers:
 *   - Google Sheets → Transform
 *   - Google Sheets → Condition
 *   - Google Sheets → HTTP
 *   - HTTP → Google Sheets
 *   - Workflow Serialization & Deserialization (Import/Export)
 *   - Replay / Execution Step Redaction
 */

const GoogleSheetsNode = require('../nodes/GoogleSheetsNode');
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
  console.log('\n🧪 Starting Google Sheets Integration Tests...\n');

  const sheetsNode = new GoogleSheetsNode();
  const transform = new TransformNode();
  const condition = new ConditionNode();
  const http = new HttpNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async () => ({
    access_token: 'mock-integration-access-token',
    refresh_token: 'mock-integration-refresh-token',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  });

  try {
    // ── Chain 1: Google Sheets → Transform ────────────────────────────────────
    console.log('Chain 1: Google Sheets → Transform');

    const ctx1 = new ExecutionContext();
    ctx1._sheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Inventory' } }] },
        }),
        values: {
          get: async () => ({
            data: {
              range: 'Inventory!A1:C4',
              values: [
                ['Item', 'Qty', 'Price'],
                ['Widget A', '10', '15.50'],
                ['Widget B', '25', '8.00'],
                ['Widget C', '5', '42.00'],
              ],
            },
          }),
        },
      },
    };

    const sheetsRes1 = await sheetsNode.execute({
      connectionId: 'conn-sheets-1',
      spreadsheetId: 'sheet-inv-123',
      sheetName: 'Inventory',
      operation: 'get_rows',
    }, ctx1);

    ctx1.setResult('sheets_inv', sheetsRes1);

    const transformRes1 = await transform.execute({
      data: {
        operation: 'map',
        mappings: [
          { outputField: 'itemCount', source: '{{sheets_inv.count}}' },
          { outputField: 'firstItem', source: '{{sheets_inv.rows.0.Item}}' },
          { outputField: 'firstQty', source: '{{sheets_inv.rows.0.Qty}}' },
        ],
      },
    }, ctx1);

    check(sheetsRes1.count === 3, 'Chain 1: Google Sheets retrieved 3 rows');
    check(transformRes1.data.firstItem === 'Widget A' && transformRes1.data.firstQty === '10', 'Chain 1: Transform mapped fields from sheets output');

    // ── Chain 2: Google Sheets → Condition ────────────────────────────────────
    console.log('Chain 2: Google Sheets → Condition');

    const ctx2 = new ExecutionContext();
    ctx2._sheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Users' } }] },
        }),
        values: {
          get: async () => ({
            data: {
              values: [
                ['User ID', 'Email', 'Role'],
                ['u_1', 'admin@example.com', 'Admin'],
                ['u_2', 'user@example.com', 'Member'],
              ],
            },
          }),
        },
      },
    };

    const sheetsRes2 = await sheetsNode.execute({
      connectionId: 'conn-sheets-1',
      spreadsheetId: 'sheet-users-123',
      sheetName: 'Users',
      operation: 'find_row',
      searchColumn: 'Email',
      searchValue: 'admin@example.com',
    }, ctx2);

    ctx2.setResult('sheets_find', sheetsRes2);

    const conditionRes2 = await condition.execute({
      data: {
        leftValue: '{{prev.row.Role}}',
        operator: 'equals',
        rightValue: 'Admin',
      },
    }, ctx2);

    check(sheetsRes2.found === true, 'Chain 2: Sheets found row');
    check(sheetsRes2.row.Role === 'Admin', 'Chain 2: Matching row has Role Admin');
    check(conditionRes2.passed === true, 'Chain 2: Condition evaluated true for Admin user');

    // ── Chain 3: Google Sheets → HTTP ─────────────────────────────────────────
    console.log('Chain 3: Google Sheets → HTTP');

    const ctx3 = new ExecutionContext();
    let appendedRow = null;
    ctx3._sheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Orders' } }] },
        }),
        values: {
          get: async () => ({
            data: { values: [['OrderID', 'Customer', 'Amount']] },
          }),
          append: async ({ requestBody }) => {
            appendedRow = requestBody.values[0];
            return {
              data: {
                updates: { updatedRange: 'Orders!A15:C15', updatedRows: 1 },
              },
            };
          },
        },
      },
    };

    const sheetsRes3 = await sheetsNode.execute({
      connectionId: 'conn-sheets-1',
      spreadsheetId: 'sheet-orders-123',
      sheetName: 'Orders',
      operation: 'add_row',
      values: { OrderID: 'ORD-999', Customer: 'Frank', Amount: '250.00' },
    }, ctx3);

    ctx3.setResult('sheets_order', sheetsRes3);

    const axios = require('axios');
    let capturedUrl = null;
    let capturedBody = null;
    const originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async (config) => {
      capturedUrl = config.url;
      capturedBody = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      return {
        data: { notified: true, row: sheetsRes3.rowNumber },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config,
      };
    };

    try {
      const httpRes3 = await http.execute({
        data: {
          url: 'https://api.example.com/notifications/row/{{sheets_order.rowNumber}}',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"orderId":"{{sheets_order.row.OrderID}}","sheetRow":{{sheets_order.rowNumber}}}',
        },
      }, ctx3);

      check(sheetsRes3.rowNumber === 15, 'Chain 3: Sheets added row at index 15');
      check(capturedUrl === 'https://api.example.com/notifications/row/15', 'Chain 3: HTTP URL resolved rowNumber 15');
      check(capturedBody.orderId === 'ORD-999' && capturedBody.sheetRow === 15, 'Chain 3: HTTP body resolved orderId and sheetRow');
      check(httpRes3.status === 200, 'Chain 3: HTTP request executed successfully');
    } finally {
      axios.defaults.adapter = originalAdapter;
    }

    // ── Chain 4: HTTP → Google Sheets ─────────────────────────────────────────
    console.log('Chain 4: HTTP → Google Sheets');

    const ctx4 = new ExecutionContext();

    // Mock HTTP response providing incoming event data
    ctx4.setResult('http_event', {
      body: {
        eventType: 'user_signup',
        user: { name: 'Grace Hopper', email: 'grace@navy.mil', tier: 'Pioneer' },
      },
      status: 200,
    });

    let sheetAppendedValues = null;
    ctx4._sheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Signups' } }] },
        }),
        values: {
          get: async () => ({
            data: { values: [['Name', 'Email', 'Tier']] },
          }),
          append: async ({ requestBody }) => {
            sheetAppendedValues = requestBody.values[0];
            return {
              data: {
                updates: { updatedRange: 'Signups!A8:C8', updatedRows: 1 },
              },
            };
          },
        },
      },
    };

    const sheetsRes4 = await sheetsNode.execute({
      connectionId: 'conn-sheets-1',
      spreadsheetId: 'sheet-signups-999',
      sheetName: 'Signups',
      operation: 'add_row',
      values: {
        Name: '{{http_event.body.user.name}}',
        Email: '{{http_event.body.user.email}}',
        Tier: '{{http_event.body.user.tier}}',
      },
    }, ctx4);

    check(sheetAppendedValues[0] === 'Grace Hopper', 'Chain 4: Resolved user.name into Sheets cell');
    check(sheetAppendedValues[1] === 'grace@navy.mil', 'Chain 4: Resolved user.email into Sheets cell');
    check(sheetAppendedValues[2] === 'Pioneer', 'Chain 4: Resolved user.tier into Sheets cell');
    check(sheetsRes4.rowNumber === 8, 'Chain 4: Sheets returned appended rowNumber 8');

    // ── 5. Workflow Serialization & Deserialization ───────────────────────────
    console.log('Test Group 5: Serialization & Deserialization');

    const workflowFixture = {
      name: 'Google Sheets Automation',
      description: 'Reads rows and triggers notifications',
      nodes: [
        {
          id: 'node_sheets',
          type: 'action-google-sheets',
          position: { x: 100, y: 100 },
          data: {
            connectionId: 'conn-sheets-secure',
            spreadsheetId: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
            sheetName: 'Sheet1',
            operation: 'get_rows',
          },
        },
        {
          id: 'node_transform',
          type: 'action-transform',
          position: { x: 300, y: 100 },
          data: {
            operation: 'map',
            mappings: [{ outputField: 'total', source: '{{node_sheets.count}}' }],
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_sheets', target: 'node_transform' },
      ],
    };

    const serialized = WorkflowSerializer.export(workflowFixture);
    check(typeof serialized === 'string', 'Serialization: exported to string');
    check(serialized.includes('action-google-sheets'), 'Serialization: includes action-google-sheets node type');

    const deserialized = WorkflowSerializer.import(serialized);
    check(deserialized.nodes.length === 2, 'Deserialization: imported 2 nodes');
    const importedSheetsNode = deserialized.nodes.find((n) => n.type === 'action-google-sheets');
    check(importedSheetsNode.data.operation === 'get_rows', 'Deserialization: preserved operation get_rows');
    check(importedSheetsNode.data.connectionId === 'conn-sheets-secure', 'Deserialization: preserved connectionId');
    check(importedSheetsNode.data.spreadsheetId.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'), 'Deserialization: preserved spreadsheet ID/URL');

    // ── 6. Replay & Execution History Secret Redaction ────────────────────────
    console.log('Test Group 6: Replay & Execution History Secret Redaction');

    const executionStepResult = {
      stepId: 'step_sheets_1',
      nodeType: 'action-google-sheets',
      inputs: {
        connectionId: 'conn-sheets-secure',
        tokens: {
          access_token: 'ya29.a0AfH6_SECRET_INTEGRATION_TOKEN_9999',
          refresh_token: '1//0gSECRET_INTEGRATION_REFRESH_TOKEN',
        },
      },
      outputs: {
        row: ['Alice', 'alice@secret.com'],
        token: 'ya29.a0AfH6_LEAKED_IN_OUTPUT',
      },
    };

    const sanitizedReplayStep = redactSecrets(executionStepResult);
    check(sanitizedReplayStep.inputs.tokens.access_token === '[REDACTED]', 'Replay: inputs access_token redacted');
    check(sanitizedReplayStep.inputs.tokens.refresh_token === '[REDACTED]', 'Replay: inputs refresh_token redacted');
    check(sanitizedReplayStep.outputs.token === '[REDACTED]', 'Replay: outputs token redacted');
    check(!JSON.stringify(sanitizedReplayStep).includes('SECRET_INTEGRATION_TOKEN'), 'Replay: serialized step contains no token secrets');

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

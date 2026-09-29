/**
 * GoogleSheetsNode Unit Tests
 * Covers:
 *   - Operations: get_rows, get_row, add_row, update_row, delete_row, find_row
 *   - Variable resolution: expressions in spreadsheet, sheet, row, search criteria
 *   - Validation: required fields, row numbers, operation errors
 *   - API error handling and secret sanitization
 */

const assert = require('assert');
const GoogleSheetsNode = require('../nodes/GoogleSheetsNode');
const ExecutionContext = require('../utils/ExecutionContext');
const ConnectionService = require('../services/ConnectionService');

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
  console.log('\n🧪 Starting GoogleSheetsNode Unit Tests...\n');

  const sheetsNode = new GoogleSheetsNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-fail') {
      throw new Error('OAuth token expired: ya29.a0AfH6_SECRET_TOKEN_VALUE');
    }
    return {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000,
    };
  };

  try {
    // ── 1. Operation: get_rows ──────────────────────────────────────────────
    console.log('Test Group 1: get_rows operation');

    const mockClientGetRows = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
        }),
        values: {
          get: async ({ spreadsheetId, range }) => {
            return {
              data: {
                range: 'Sheet1!A1:C3',
                values: [
                  ['ID', 'Name', 'Email'],
                  ['1', 'Alice', 'alice@example.com'],
                  ['2', 'Bob', 'bob@example.com'],
                ],
              },
            };
          },
        },
      },
    };

    const ctx1 = new ExecutionContext();
    ctx1._sheetsClient = mockClientGetRows;

    const res1 = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'https://docs.google.com/spreadsheets/d/abc12345/edit',
      sheetName: 'Sheet1',
      operation: 'get_rows',
    }, ctx1);

    check(res1.count === 2, 'get_rows: returns count of 2');
    check(Array.isArray(res1.rows) && res1.rows.length === 2, 'get_rows: returns rows array');
    check(res1.rows[0].Name === 'Alice' && res1.rows[0].Email === 'alice@example.com', 'get_rows: maps rows by header');
    check(res1.rows[0]._rowNumber === 2, 'get_rows: attaches 1-based _rowNumber');
    check(Array.isArray(res1.headers) && res1.headers[0] === 'ID', 'get_rows: returns headers');

    // ── 2. Operation: get_row ───────────────────────────────────────────────
    console.log('Test Group 2: get_row operation');

    const mockClientGetRow = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
        }),
        values: {
          get: async ({ range }) => {
            if (range.includes('A1:ZZ1') || range.includes('1:1')) {
              return { data: { values: [['ID', 'Name', 'Role']] } };
            }
            return { data: { values: [['101', 'Charlie', 'Admin']] } };
          },
        },
      },
    };

    const ctx2 = new ExecutionContext();
    ctx2._sheetsClient = mockClientGetRow;

    const res2 = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-456',
      sheetName: 'Sheet1',
      operation: 'get_row',
      rowNumber: 2,
    }, ctx2);

    check(res2.found === true, 'get_row: returns found: true');
    check(res2.rowNumber === 2, 'get_row: returns correct rowNumber');
    check(res2.row.Name === 'Charlie' && res2.row.Role === 'Admin', 'get_row: returns structured row object');

    // ── 3. Operation: add_row ───────────────────────────────────────────────
    console.log('Test Group 3: add_row operation');

    let appendPayload = null;
    const mockClientAddRow = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Customers' } }] },
        }),
        values: {
          get: async () => ({
            data: { values: [['Name', 'Email', 'Plan']] },
          }),
          append: async ({ spreadsheetId, range, requestBody }) => {
            appendPayload = requestBody;
            return {
              data: {
                updates: {
                  updatedRange: 'Customers!A5:C5',
                  updatedRows: 1,
                },
              },
            };
          },
        },
      },
    };

    const ctx3 = new ExecutionContext();
    ctx3._sheetsClient = mockClientAddRow;

    const res3 = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-789',
      sheetName: 'Customers',
      operation: 'add_row',
      values: { Name: 'Diana', Email: 'diana@example.com', Plan: 'Pro' },
    }, ctx3);

    check(res3.rowNumber === 5, 'add_row: extracts rowNumber from updatedRange');
    check(res3.row.Name === 'Diana', 'add_row: returns structured row');
    check(appendPayload && appendPayload.values[0][0] === 'Diana', 'add_row: payload formatted according to headers');

    // ── 4. Operation: update_row ────────────────────────────────────────────
    console.log('Test Group 4: update_row operation');

    let updateRange = null;
    let updateValues = null;
    const mockClientUpdateRow = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Customers' } }] },
        }),
        values: {
          get: async () => ({
            data: { values: [['Name', 'Email', 'Plan']] },
          }),
          update: async ({ range, requestBody }) => {
            updateRange = range;
            updateValues = requestBody.values;
            return {
              data: {
                updatedRange: range,
                updatedRows: 1,
              },
            };
          },
        },
      },
    };

    const ctx4 = new ExecutionContext();
    ctx4._sheetsClient = mockClientUpdateRow;

    const res4 = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-789',
      sheetName: 'Customers',
      operation: 'update_row',
      rowNumber: 3,
      values: { Name: 'Diana Updated', Email: 'diana.new@example.com', Plan: 'Enterprise' },
    }, ctx4);

    check(res4.updated === true, 'update_row: returns updated: true');
    check(res4.rowNumber === 3, 'update_row: confirms updated rowNumber 3');
    check(updateRange.includes('A3') || updateRange.includes('3'), 'update_row: updates target row 3');
    check(updateValues[0][0] === 'Diana Updated', 'update_row: sets updated values');

    // ── 5. Operation: delete_row ────────────────────────────────────────────
    console.log('Test Group 5: delete_row operation');

    let batchUpdateRequests = null;
    const mockClientDeleteRow = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 42, title: 'Customers' } }] },
        }),
        batchUpdate: async ({ spreadsheetId, requestBody }) => {
          batchUpdateRequests = requestBody.requests;
          return { data: {} };
        },
      },
    };

    const ctx5 = new ExecutionContext();
    ctx5._sheetsClient = mockClientDeleteRow;

    const res5 = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-789',
      sheetName: 'Customers',
      operation: 'delete_row',
      rowNumber: 4,
    }, ctx5);

    check(res5.deleted === true, 'delete_row: returns deleted: true');
    check(res5.rowNumber === 4, 'delete_row: returns rowNumber 4');
    check(batchUpdateRequests && batchUpdateRequests[0].deleteDimension, 'delete_row: sends deleteDimension request');
    check(batchUpdateRequests[0].deleteDimension.range.startIndex === 3, 'delete_row: 0-indexed startIndex is 3 for row 4');
    check(batchUpdateRequests[0].deleteDimension.range.endIndex === 4, 'delete_row: 0-indexed endIndex is 4 for row 4');
    check(batchUpdateRequests[0].deleteDimension.range.sheetId === 42, 'delete_row: matches sheetId 42');

    // ── 6. Operation: find_row ──────────────────────────────────────────────
    console.log('Test Group 6: find_row operation');

    const mockClientFindRow = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
        }),
        values: {
          get: async () => ({
            data: {
              values: [
                ['User ID', 'Email', 'Active'],
                ['u_1', 'alice@test.com', 'true'],
                ['u_2', 'bob@test.com', 'false'],
                ['u_3', 'charlie@test.com', 'true'],
              ],
            },
          }),
        },
      },
    };

    const ctx6 = new ExecutionContext();
    ctx6._sheetsClient = mockClientFindRow;

    // Search by header name
    const res6a = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-find',
      sheetName: 'Sheet1',
      operation: 'find_row',
      searchColumn: 'Email',
      searchValue: 'bob@test.com',
    }, ctx6);

    check(res6a.found === true, 'find_row: finds row by header name');
    check(res6a.rowNumber === 3, 'find_row: finds correct rowNumber 3');
    check(res6a.row['User ID'] === 'u_2', 'find_row: returns matching row data');

    // Search by column letter
    const res6b = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-find',
      sheetName: 'Sheet1',
      operation: 'find_row',
      searchColumn: 'A',
      searchValue: 'u_3',
    }, ctx6);

    check(res6b.found === true, 'find_row: finds row by column letter');
    check(res6b.rowNumber === 4, 'find_row: finds correct rowNumber 4');

    // Not found
    const res6c = await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: 'sheet-id-find',
      sheetName: 'Sheet1',
      operation: 'find_row',
      searchColumn: 'Email',
      searchValue: 'nonexistent@test.com',
    }, ctx6);

    check(res6c.found === false, 'find_row: returns found: false when not found');
    check(res6c.row === null, 'find_row: returns row: null when not found');

    // ── 7. Variable Resolution ──────────────────────────────────────────────
    console.log('Test Group 7: Variable resolution');

    const ctx7 = new ExecutionContext();
    ctx7.setResult('prev', {
      data: {
        docId: 'dynamic-doc-999',
        tabName: 'DynamicSheet',
        targetRow: 12,
        query: 'search-keyword',
        payload: { Name: 'Resolved Name', Score: 100 },
      },
    });

    let inspectedRange = null;
    let inspectedSpreadsheetId = null;
    ctx7._sheetsClient = {
      spreadsheets: {
        get: async ({ spreadsheetId }) => {
          return { data: { sheets: [{ properties: { sheetId: 0, title: 'DynamicSheet' } }] } };
        },
        values: {
          get: async ({ spreadsheetId, range }) => {
            inspectedSpreadsheetId = spreadsheetId;
            inspectedRange = range;
            return {
              data: {
                values: [['Header1'], ['Value1']],
              },
            };
          },
        },
      },
    };

    await sheetsNode.execute({
      connectionId: 'conn-1',
      spreadsheetId: '{{prev.data.docId}}',
      sheetName: '{{prev.data.tabName}}',
      operation: 'get_row',
      rowNumber: '{{prev.data.targetRow}}',
    }, ctx7);

    check(inspectedSpreadsheetId === 'dynamic-doc-999', 'variables: resolved spreadsheetId from {{prev.data.docId}}');
    check(inspectedRange.includes('DynamicSheet') && inspectedRange.includes('12'), 'variables: resolved sheetName and rowNumber from variables');

    // ── 8. Validation ───────────────────────────────────────────────────────
    console.log('Test Group 8: Validation errors');

    const testValidation = async (config, expectedMsg, label) => {
      try {
        await sheetsNode.execute(config, new ExecutionContext());
        check(false, `${label} (expected error)`);
      } catch (err) {
        check(err.message.includes(expectedMsg), `${label}: caught expected "${expectedMsg}"`);
      }
    };

    await testValidation({}, 'Google Sheets connection is required', 'Validation: missing connectionId');
    await testValidation({ connectionId: 'c1' }, 'Spreadsheet ID or URL is required', 'Validation: missing spreadsheet');
    await testValidation({ connectionId: 'c1', spreadsheetId: 's1', operation: 'unknown_op' }, 'Invalid operation', 'Validation: invalid operation');
    await testValidation({ connectionId: 'c1', spreadsheetId: 's1', operation: 'get_row' }, 'Row number is required', 'Validation: missing rowNumber for get_row');
    await testValidation({ connectionId: 'c1', spreadsheetId: 's1', operation: 'update_row', rowNumber: 2 }, 'Row data/values are required', 'Validation: missing values for update_row');
    await testValidation({ connectionId: 'c1', spreadsheetId: 's1', operation: 'find_row' }, 'Search column is required', 'Validation: missing criteria for find_row');

    // ── 9. Error Sanitization ───────────────────────────────────────────────
    console.log('Test Group 9: Error sanitization');

    try {
      await sheetsNode.execute({
        connectionId: 'conn-fail',
        spreadsheetId: 'doc1',
        operation: 'get_rows',
      }, new ExecutionContext());
      check(false, 'Error sanitization: expected error');
    } catch (err) {
      check(!err.message.includes('SECRET_TOKEN_VALUE'), 'Error sanitization: token value stripped from error message');
      check(err.message.includes('[REDACTED]'), 'Error sanitization: replaced with [REDACTED]');
    }

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

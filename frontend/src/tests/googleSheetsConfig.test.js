/**
 * Frontend Google Sheets Node Configuration & Validation Unit Tests
 * Covers: action-google-sheets validation rules in NodeValidator
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
  console.log('\n🧪 Starting Frontend Google Sheets Node Validation Unit Tests...\n');

  // ── Group 1: General & Required Configuration ──────────────────────────────
  console.log('Group 1: General & Required Configuration');

  const validGetRows = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      sheet: 'Sheet1',
      operation: 'get_rows',
    },
  };
  assert(NodeValidator.validateNode(validGetRows).valid === true, 'Google Sheets: validates valid get_rows');

  const missingConn = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      spreadsheet: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      operation: 'get_rows',
    },
  };
  const missingConnRes = NodeValidator.validateNode(missingConn);
  assert(missingConnRes.valid === false && missingConnRes.error?.includes('Google Sheets connection is required'), 'Google Sheets: rejects missing connection');

  const missingSpreadsheet = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      operation: 'get_rows',
      spreadsheet: '',
    },
  };
  const missingSpreadsheetRes = NodeValidator.validateNode(missingSpreadsheet);
  assert(missingSpreadsheetRes.valid === false && missingSpreadsheetRes.error?.includes('Spreadsheet ID or URL is required'), 'Google Sheets: rejects missing spreadsheet');

  const invalidOp = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'drop_sheet',
    },
  };
  const invalidOpRes = NodeValidator.validateNode(invalidOp);
  assert(invalidOpRes.valid === false && invalidOpRes.error?.includes('Invalid operation'), 'Google Sheets: rejects unsupported operation');

  // ── Group 2: Operation-Specific Rules ──────────────────────────────────────
  console.log('\nGroup 2: Operation-Specific Rules');

  // Get Row: requires rowNumber
  const validGetRow = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'get_row',
      rowNumber: 5,
    },
  };
  assert(NodeValidator.validateNode(validGetRow).valid === true, 'Google Sheets: validates valid get_row with rowNumber');

  const missingGetRowNumber = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'get_row',
      rowNumber: '',
    },
  };
  assert(NodeValidator.validateNode(missingGetRowNumber).valid === false, 'Google Sheets: rejects get_row without rowNumber');

  // Add Row: requires row or values
  const validAddRow = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'add_row',
      values: '{"name": "Alice", "role": "Engineer"}',
    },
  };
  assert(NodeValidator.validateNode(validAddRow).valid === true, 'Google Sheets: validates valid add_row with values');

  const missingAddRowValues = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'add_row',
      values: '',
      row: '',
    },
  };
  assert(NodeValidator.validateNode(missingAddRowValues).valid === false, 'Google Sheets: rejects add_row without row/values');

  // Update Row: requires rowNumber and row/values
  const validUpdateRow = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'update_row',
      rowNumber: 2,
      values: '["Bob", "bob@example.com"]',
    },
  };
  assert(NodeValidator.validateNode(validUpdateRow).valid === true, 'Google Sheets: validates valid update_row with rowNumber and values');

  const missingUpdateRowNumber = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'update_row',
      rowNumber: '',
      values: '["Bob"]',
    },
  };
  assert(NodeValidator.validateNode(missingUpdateRowNumber).valid === false, 'Google Sheets: rejects update_row without rowNumber');

  // Delete Row: requires rowNumber
  const validDeleteRow = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'delete_row',
      rowNumber: 3,
    },
  };
  assert(NodeValidator.validateNode(validDeleteRow).valid === true, 'Google Sheets: validates valid delete_row with rowNumber');

  const missingDeleteRowNumber = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'delete_row',
      rowNumber: '',
    },
  };
  assert(NodeValidator.validateNode(missingDeleteRowNumber).valid === false, 'Google Sheets: rejects delete_row without rowNumber');

  // Find Row: requires searchColumn and searchValue
  const validFindRow = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'find_row',
      searchColumn: 'Email',
      searchValue: 'alice@example.com',
    },
  };
  assert(NodeValidator.validateNode(validFindRow).valid === true, 'Google Sheets: validates valid find_row');

  const missingFindCol = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'find_row',
      searchColumn: '',
      searchValue: 'alice@example.com',
    },
  };
  assert(NodeValidator.validateNode(missingFindCol).valid === false, 'Google Sheets: rejects find_row without searchColumn');

  const missingFindVal = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'find_row',
      searchColumn: 'Email',
      searchValue: '',
    },
  };
  assert(NodeValidator.validateNode(missingFindVal).valid === false, 'Google Sheets: rejects find_row without searchValue');

  // Variable support in rowNumber (e.g. {{prev.data.rowNumber}})
  const varRowNumber = {
    type: NodeTypes.ACTION_GOOGLE_SHEETS,
    data: {
      connectionId: 'conn-1',
      spreadsheet: 'sheet-123',
      operation: 'get_row',
      rowNumber: '{{prev.data.rowNumber}}',
    },
  };
  assert(NodeValidator.validateNode(varRowNumber).valid === true, 'Google Sheets: accepts variable expression for rowNumber');

  console.log(`\n${passed} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();

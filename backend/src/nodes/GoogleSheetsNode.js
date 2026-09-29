const { google } = require('googleapis');
const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const ConnectionService = require('../services/ConnectionService');
const OAuthService = require('../services/OAuthService');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * Extracts pure spreadsheet ID from a full Google Sheets URL or raw ID
 */
function extractSpreadsheetId(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

/**
 * Converts a column identifier ('A', 'B', 'AA', etc.) to 0-based index
 */
function columnLetterToIndex(letter) {
  if (!letter || typeof letter !== 'string') return -1;
  const upper = letter.toUpperCase().trim();
  if (!/^[A-Z]+$/.test(upper)) return -1;
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Resolves variables inside strings, objects, or arrays against context
 */
function resolveValueWithContext(value, context) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') {
        const res = resolveVariable(item, context);
        try { return JSON.parse(res); } catch { return res; }
      }
      return item;
    });
  }
  if (typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') {
        const res = resolveVariable(v, context);
        try { resolved[k] = JSON.parse(res); } catch { resolved[k] = res; }
      } else {
        resolved[k] = v;
      }
    }
    return resolved;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const resolvedStr = resolveVariable(trimmed, context);
    try { return JSON.parse(resolvedStr); } catch { return resolvedStr; }
  }
  return value;
}

/**
 * Maps a raw array of row cells to an object using headers
 */
function mapRowToObject(rowArray, headers = []) {
  if (!rowArray || !Array.isArray(rowArray)) return rowArray;
  if (!headers || !Array.isArray(headers) || headers.length === 0) return rowArray;
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = String(headers[i]).trim();
    if (key) {
      obj[key] = rowArray[i] !== undefined ? rowArray[i] : '';
    }
  }
  return obj;
}

/**
 * Resolves values input into an array of cells
 */
function normalizeRowValues(val, headers = []) {
  if (val === null || val === undefined) return [];

  let parsed = val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Fall back to splitting by comma if not valid JSON
        parsed = trimmed.split(',').map((s) => s.trim());
      }
    } else {
      parsed = trimmed.split(',').map((s) => s.trim());
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : item));
  }

  if (typeof parsed === 'object' && parsed !== null) {
    if (headers && headers.length > 0) {
      // Map object properties to header positions
      return headers.map((h) => parsed[h] ?? parsed[h.toLowerCase()] ?? '');
    }
    return Object.values(parsed);
  }

  return [String(parsed)];
}

class GoogleSheetsNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_GOOGLE_SHEETS,
      name: 'Google Sheets',
      category: 'action',
      icon: '📊',
      description: 'Read, write, update, and manage Google Sheets spreadsheets',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = (node && node.data !== undefined) ? node.data : (node || {});
    const {
      connectionId,
      operation = 'get_rows',
      spreadsheet,
      spreadsheetId,
      sheet,
      sheetName,
      rowNumber,
      searchColumn,
      searchValue,
      row,
      values,
      data: rowData,
    } = data;

    if (!connectionId || !String(connectionId).trim()) {
      return { valid: false, error: 'Google Sheets connection is required' };
    }

    const validOps = [
      'get_rows', 'getrows', 'get-rows',
      'get_row', 'getrow', 'get-row',
      'add_row', 'addrow', 'add-row', 'append',
      'update_row', 'updaterow', 'update-row',
      'delete_row', 'deleterow', 'delete-row',
      'find_row', 'findrow', 'find-row',
    ];

    const opKey = String(operation).toLowerCase().replace(/[^a-z]/g, '');
    if (!validOps.map((o) => o.replace(/[^a-z]/g, '')).includes(opKey)) {
      return { valid: false, error: `Invalid operation "${operation}". Supported: Get Rows, Get Row, Add Row, Update Row, Delete Row, Find Row` };
    }

    const targetSpreadsheet = spreadsheet || spreadsheetId;
    if (!targetSpreadsheet || !String(targetSpreadsheet).trim()) {
      return { valid: false, error: 'Spreadsheet ID or URL is required' };
    }

    if (opKey === 'getrow' || opKey === 'updaterow' || opKey === 'deleterow') {
      if (rowNumber === undefined || rowNumber === null || String(rowNumber).trim() === '') {
        return { valid: false, error: `Row number is required for ${operation} operation` };
      }
    }

    if (opKey === 'addrow' || opKey === 'append') {
      const val = row || values || rowData;
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0)) {
        return { valid: false, error: 'Row data/values are required for Add Row operation' };
      }
    }

    if (opKey === 'updaterow') {
      const val = row || values || rowData;
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0)) {
        return { valid: false, error: 'Row data/values are required for Update Row operation' };
      }
    }

    if (opKey === 'findrow') {
      if (!searchColumn || !String(searchColumn).trim()) {
        return { valid: false, error: 'Search column is required for Find Row operation' };
      }
      if (searchValue === undefined || searchValue === null || String(searchValue).trim() === '') {
        return { valid: false, error: 'Search value is required for Find Row operation' };
      }
    }

    return { valid: true };
  }

  async execute(node, context) {
    const data = (node && node.data !== undefined) ? node.data : (node || {});
    const {
      connectionId,
      operation = 'get_rows',
      spreadsheet,
      spreadsheetId,
      sheet = 'Sheet1',
      sheetName,
      range,
      rowNumber,
      searchColumn,
      searchValue,
      row,
      values,
      data: rowData,
    } = data;

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    // 1. Resolve variables in configuration fields
    const resolvedSpreadsheetRaw = resolveVariable(spreadsheet || spreadsheetId || '', context);
    const targetSpreadsheetId = extractSpreadsheetId(resolvedSpreadsheetRaw);

    const resolvedSheetName = resolveVariable(sheetName || sheet || 'Sheet1', context).trim() || 'Sheet1';
    const resolvedRange = range ? resolveVariable(range, context).trim() : '';

    const resolvedRowNumberStr = rowNumber !== undefined && rowNumber !== null ? resolveVariable(String(rowNumber), context) : '';
    const parsedRowNumber = resolvedRowNumberStr ? parseInt(resolvedRowNumberStr, 10) : NaN;

    const resolvedSearchCol = searchColumn ? resolveVariable(searchColumn, context).trim() : '';
    const resolvedSearchVal = searchValue !== undefined && searchValue !== null ? resolveVariable(String(searchValue), context).trim() : '';

    // 2. Obtain authenticated client
    const ownerId = context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
    let credentials;
    try {
      credentials = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
    } catch (err) {
      const sanitized = (err.message || 'Connection error').replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]');
      throw new NodeExecutionError(`Failed to retrieve Google Sheets connection: ${sanitized}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    }

    let sheets;
    if (context?._sheetsClient || this._sheetsOverride) {
      sheets = context._sheetsClient || this._sheetsOverride;
    } else {
      const { client } = await OAuthService.buildAuthenticatedClient(credentials);
      sheets = google.sheets({ version: 'v4', auth: client });
    }

    const opKey = String(operation).toLowerCase().replace(/[^a-z]/g, '');

    try {
      switch (opKey) {
        // ── Get Rows ───────────────────────────────────────────────────────────
        case 'getrows': {
          const queryRange = resolvedRange || `${resolvedSheetName}!A1:ZZ`;
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: queryRange,
          });

          const rawRows = response.data?.values || [];
          let headers = [];
          let objectRows = [];

          if (rawRows.length > 0) {
            headers = rawRows[0].map(String);
            objectRows = rawRows.slice(1).map((r, idx) => {
              const rowObj = { _rowNumber: idx + 2 };
              headers.forEach((h, hIdx) => {
                rowObj[h] = r[hIdx] !== undefined ? r[hIdx] : '';
              });
              return rowObj;
            });
          }

          return {
            rows: objectRows.length > 0 ? objectRows : rawRows,
            count: objectRows.length > 0 ? objectRows.length : rawRows.length,
            rawRows,
            headers,
            operation: 'get_rows',
            data: objectRows.length > 0 ? objectRows : rawRows,
          };
        }

        // ── Get Row ────────────────────────────────────────────────────────────
        case 'getrow': {
          if (isNaN(parsedRowNumber) || parsedRowNumber < 1) {
            throw new Error(`Invalid row number "${resolvedRowNumberStr}". Row numbers must be >= 1.`);
          }

          let existingHeaders = [];
          if (parsedRowNumber > 1) {
            try {
              const headerRes = await sheets.spreadsheets.values.get({
                spreadsheetId: targetSpreadsheetId,
                range: `${resolvedSheetName}!A1:ZZ1`,
              });
              existingHeaders = headerRes.data?.values?.[0] || [];
            } catch {
              // Ignore
            }
          }

          const queryRange = `${resolvedSheetName}!A${parsedRowNumber}:ZZ${parsedRowNumber}`;
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: queryRange,
          });

          const rawRow = response.data?.values?.[0] || null;
          let rowObj = rawRow;
          if (rawRow && existingHeaders.length > 0) {
            rowObj = mapRowToObject(rawRow, existingHeaders);
            rowObj._rowNumber = parsedRowNumber;
          }

          return {
            row: rowObj,
            rawRow,
            rowNumber: parsedRowNumber,
            found: Boolean(rawRow && rawRow.length > 0),
            operation: 'get_row',
            data: rowObj,
          };
        }

        // ── Add Row ────────────────────────────────────────────────────────────
        case 'addrow':
        case 'append': {
          // Check if sheet has headers to support object mapping
          let existingHeaders = [];
          try {
            const headerRes = await sheets.spreadsheets.values.get({
              spreadsheetId: targetSpreadsheetId,
              range: `${resolvedSheetName}!A1:ZZ1`,
            });
            existingHeaders = headerRes.data?.values?.[0] || [];
          } catch {
            // Non-fatal if sheet is empty or headers cannot be read
          }

          const rawValues = row || values || rowData;
          const resolvedRaw = resolveValueWithContext(rawValues, context);
          const rowArray = normalizeRowValues(resolvedRaw, existingHeaders);

          const appendRes = await sheets.spreadsheets.values.append({
            spreadsheetId: targetSpreadsheetId,
            range: `${resolvedSheetName}!A:A`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [rowArray],
            },
          });

          const updatedRange = appendRes.data?.updates?.updatedRange || '';
          let appendedRowNumber = null;
          const matchRow = updatedRange.match(/!A(\d+)/i) || updatedRange.match(/(\d+):[A-Z]+(\d+)/i);
          if (matchRow) {
            appendedRowNumber = parseInt(matchRow[1], 10);
          }

          let rowResult = rowArray;
          if (typeof resolvedRaw === 'object' && !Array.isArray(resolvedRaw)) {
            rowResult = resolvedRaw;
          } else if (existingHeaders.length > 0) {
            rowResult = mapRowToObject(rowArray, existingHeaders);
          }

          return {
            row: rowResult,
            rawRow: rowArray,
            rowNumber: appendedRowNumber,
            updatedRange,
            operation: 'add_row',
            data: { row: rowResult, rowNumber: appendedRowNumber },
          };
        }

        // ── Update Row ─────────────────────────────────────────────────────────
        case 'updaterow': {
          if (isNaN(parsedRowNumber) || parsedRowNumber < 1) {
            throw new Error(`Invalid row number "${resolvedRowNumberStr}". Row numbers must be >= 1.`);
          }

          let existingHeaders = [];
          try {
            const headerRes = await sheets.spreadsheets.values.get({
              spreadsheetId: targetSpreadsheetId,
              range: `${resolvedSheetName}!A1:ZZ1`,
            });
            existingHeaders = headerRes.data?.values?.[0] || [];
          } catch {
            // Ignore
          }

          const rawValues = row || values || rowData;
          const resolvedRaw = resolveValueWithContext(rawValues, context);
          const rowArray = normalizeRowValues(resolvedRaw, existingHeaders);

          const updateRange = `${resolvedSheetName}!A${parsedRowNumber}:ZZ${parsedRowNumber}`;
          const updateRes = await sheets.spreadsheets.values.update({
            spreadsheetId: targetSpreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [rowArray],
            },
          });

          let rowResult = rowArray;
          if (typeof resolvedRaw === 'object' && !Array.isArray(resolvedRaw)) {
            rowResult = resolvedRaw;
          } else if (existingHeaders.length > 0) {
            rowResult = mapRowToObject(rowArray, existingHeaders);
          }

          return {
            row: rowResult,
            rawRow: rowArray,
            rowNumber: parsedRowNumber,
            updated: true,
            updatedRange: updateRes.data?.updatedRange || updateRange,
            operation: 'update_row',
            data: { row: rowResult, rowNumber: parsedRowNumber },
          };
        }

        // ── Delete Row ─────────────────────────────────────────────────────────
        case 'deleterow': {
          if (isNaN(parsedRowNumber) || parsedRowNumber < 1) {
            throw new Error(`Invalid row number "${resolvedRowNumberStr}". Row numbers must be >= 1.`);
          }

          // Get numeric sheetId (gid) from sheetName
          const meta = await sheets.spreadsheets.get({
            spreadsheetId: targetSpreadsheetId,
          });

          const sheetObj =
            meta.data?.sheets?.find((s) => s.properties?.title === resolvedSheetName) ||
            meta.data?.sheets?.[0];

          if (!sheetObj || sheetObj.properties?.sheetId === undefined) {
            throw new Error(`Sheet "${resolvedSheetName}" not found in spreadsheet.`);
          }

          const sheetId = sheetObj.properties.sheetId;

          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: targetSpreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId,
                      dimension: 'ROWS',
                      startIndex: parsedRowNumber - 1,
                      endIndex: parsedRowNumber,
                    },
                  },
                },
              ],
            },
          });

          return {
            deleted: true,
            rowNumber: parsedRowNumber,
            operation: 'delete_row',
            data: { deleted: true, rowNumber: parsedRowNumber },
          };
        }

        // ── Find Row ───────────────────────────────────────────────────────────
        case 'findrow': {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: `${resolvedSheetName}!A1:ZZ`,
          });

          const rawRows = response.data?.values || [];
          if (rawRows.length === 0) {
            return {
              found: false,
              row: null,
              rowNumber: -1,
              operation: 'find_row',
              data: null,
            };
          }

          // Determine column index to search
          let colIndex = -1;
          const headers = rawRows[0] ? rawRows[0].map((h) => String(h).trim()) : [];
          if (headers.length > 0) {
            const headersLower = headers.map((h) => h.toLowerCase());
            colIndex = headersLower.indexOf(resolvedSearchCol.toLowerCase());
          }

          if (colIndex < 0 && /^[A-Za-z]{1,3}$/.test(resolvedSearchCol)) {
            colIndex = columnLetterToIndex(resolvedSearchCol);
          }

          if (colIndex < 0) {
            throw new Error(`Search column "${resolvedSearchCol}" could not be resolved as a column letter (e.g. A, B) or valid header.`);
          }

          let foundRawRow = null;
          let foundRowNumber = -1;

          // Start search from row 2 if header row exists and headers matched, else row 1
          const startRowIdx = headers.length > 0 && colIndex < headers.length ? 1 : 0;
          for (let i = startRowIdx; i < rawRows.length; i++) {
            const cellValue = rawRows[i] && rawRows[i][colIndex] !== undefined ? String(rawRows[i][colIndex]).trim() : '';
            if (cellValue === resolvedSearchVal || cellValue.toLowerCase() === resolvedSearchVal.toLowerCase()) {
              foundRawRow = rawRows[i];
              foundRowNumber = i + 1;
              break;
            }
          }

          if (!foundRawRow) {
            return {
              found: false,
              row: null,
              rowNumber: -1,
              operation: 'find_row',
              data: null,
            };
          }

          let foundRowObj = foundRawRow;
          if (headers.length > 0) {
            foundRowObj = mapRowToObject(foundRawRow, headers);
            foundRowObj._rowNumber = foundRowNumber;
          }

          return {
            found: true,
            row: foundRowObj,
            rawRow: foundRawRow,
            rowNumber: foundRowNumber,
            operation: 'find_row',
            data: foundRowObj,
          };
        }

        default:
          throw new Error(`Unsupported Google Sheets operation "${operation}"`);
      }
    } catch (err) {
      if (err instanceof NodeExecutionError) {
        throw err;
      }
      const sanitized = (err.message || 'Google Sheets API error')
        .replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]')
        .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');

      throw new NodeExecutionError(`Google Sheets error: ${sanitized}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    }
  }
}

module.exports = GoogleSheetsNode;

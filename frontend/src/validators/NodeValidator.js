import { NodeTypes } from '../constants/NodeTypes.js';

/**
 * Frontend validation rules for step configuration and branch connection logic
 */
export class NodeValidator {
  /**
   * Validates a node's data payload before testing or execution
   * @param {object} node - React Flow node object
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateNode(node) {
    if (!node) return { valid: false, error: 'No step selected' };
    const { type, data } = node;

    if (type === NodeTypes.ACTION_HTTP) {
      if (!data?.url || !data.url.trim()) {
        return { valid: false, error: 'HTTP URL is required' };
      }
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      if (data?.method && !validMethods.includes(String(data.method).toUpperCase())) {
        return { valid: false, error: `Invalid HTTP method "${data.method}"` };
      }
      if (data?.authType === 'bearer' && !data.authToken?.trim()) {
        return { valid: false, error: 'Bearer Token is required when Bearer Auth is selected' };
      }
      if (data?.authType === 'api_key' && (!data.apiKey?.trim() || !data.apiValue?.trim())) {
        return { valid: false, error: 'API Key name and value are required when API Key Auth is selected' };
      }
      if (data?.authType === 'basic' && (!data.authUsername?.trim() || !data.authPassword?.trim())) {
        return { valid: false, error: 'Username and password are required when Basic Auth is selected' };
      }
      if (data?.authType === 'connection' && !data.connectionId) {
        return { valid: false, error: 'Saved Connection must be selected when Connection Auth is chosen' };
      }
      if (data?.contentType === 'json' && data?.body && typeof data.body === 'string' && !data.body.includes('{{')) {
        try {
          JSON.parse(data.body);
        } catch {
          return { valid: false, error: 'Transform body template must be valid JSON' };
        }
      }
      if (data?.timeout !== undefined && (isNaN(Number(data.timeout)) || Number(data.timeout) < 100 || Number(data.timeout) > 300000)) {
        return { valid: false, error: 'Timeout must be between 100ms and 300,000ms' };
      }
      if (data?.retries !== undefined && (isNaN(Number(data.retries)) || Number(data.retries) < 0 || Number(data.retries) > 5)) {
        return { valid: false, error: 'Retries must be an integer between 0 and 5' };
      }
    }

    if (type === NodeTypes.ACTION_CSV) {
      if (!data?.columns || (Array.isArray(data.columns) && data.columns.length === 0)) {
        return { valid: false, error: 'At least one CSV column definition is required' };
      }
    }

    if (type === NodeTypes.ACTION_TRANSFORM) {
      const validOps = ['map', 'pick', 'omit', 'set', 'remove', 'array-map', 'array-filter', 'array-find', 'array-first', 'array-last', 'array-length'];
      const op = data?.operation || 'map';
      if (!validOps.includes(op)) {
        return { valid: false, error: `Unsupported transform operation "${op}"` };
      }
      if (['map', 'set', 'array-map'].includes(op)) {
        const mappings = data?.mappings || [];
        const valid = mappings.some((m) => m.outputField && String(m.outputField).trim());
        if (!valid) {
          return { valid: false, error: `Transform "${op}" requires at least one field mapping` };
        }
      }
      if (['pick', 'omit', 'remove'].includes(op)) {
        const fields = data?.fields || [];
        if (!fields.some((f) => f && String(f).trim())) {
          return { valid: false, error: `Transform "${op}" requires at least one field name` };
        }
      }
      if (['array-filter', 'array-find'].includes(op) && !data?.filterField?.trim()) {
        return { valid: false, error: `Transform "${op}" requires a filter field name` };
      }
    }

    if (type === NodeTypes.ACTION_JSON) {
      const validJsonOps = ['parse', 'stringify', 'get', 'set', 'remove'];
      const op = data?.operation;
      if (!op || !validJsonOps.includes(op)) {
        return { valid: false, error: 'JSON operation is required' };
      }
      if (op === 'parse' && !data?.input?.trim()) {
        return { valid: false, error: 'JSON "parse" requires an input value' };
      }
      if ((op === 'get' || op === 'set' || op === 'remove') && !data?.path?.trim()) {
        return { valid: false, error: `JSON "${op}" requires a property path` };
      }
    }

    if (type === NodeTypes.ACTION_TEXT) {
      const validTextOps = ['uppercase', 'lowercase', 'trim', 'replace', 'contains', 'startsWith', 'endsWith', 'split', 'join', 'length', 'substring'];
      const op = data?.operation;
      if (!op || !validTextOps.includes(op)) {
        return { valid: false, error: 'Text operation is required' };
      }
      if (!data?.input?.trim()) {
        return { valid: false, error: `Text "${op}" requires an input value` };
      }
      if (op === 'replace' && !String(data?.find ?? '')) {
        return { valid: false, error: 'Text "replace" requires a Find value' };
      }
      if ((op === 'contains' || op === 'startsWith' || op === 'endsWith') && data?.search === undefined) {
        return { valid: false, error: `Text "${op}" requires a search value` };
      }
    }

    if (type === NodeTypes.ACTION_MATH) {
      const unaryOps = ['round', 'floor', 'ceil', 'absolute'];
      const binaryOps = ['add', 'subtract', 'multiply', 'divide', 'modulo', 'min', 'max', 'percentage'];
      const allOps = [...unaryOps, ...binaryOps];
      const op = data?.operation;
      if (!op || !allOps.includes(op)) {
        return { valid: false, error: 'Math operation is required' };
      }
      if (!data?.valueA?.trim()) {
        return { valid: false, error: `Math "${op}" requires Value A` };
      }
      if (binaryOps.includes(op) && !data?.valueB?.trim()) {
        return { valid: false, error: `Math "${op}" requires Value B` };
      }
    }

    if (type === NodeTypes.ACTION_DATE) {
      const validDateOps = ['now', 'parse', 'format', 'add', 'subtract', 'compare', 'difference'];
      const op = data?.operation;
      if (!op || !validDateOps.includes(op)) {
        return { valid: false, error: 'Date operation is required' };
      }
      const needsInput = ['parse', 'format', 'add', 'subtract'];
      if (needsInput.includes(op) && !data?.dateInput?.trim()) {
        return { valid: false, error: `Date "${op}" requires a date input value` };
      }
      if ((op === 'add' || op === 'subtract') && !data?.amount?.trim()) {
        return { valid: false, error: `Date "${op}" requires an amount` };
      }
      if ((op === 'compare' || op === 'difference') && (!data?.dateA?.trim() || !data?.dateB?.trim())) {
        return { valid: false, error: `Date "${op}" requires both Date A and Date B` };
      }
    }

    if (type === NodeTypes.ACTION_POSTGRES) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'PostgreSQL connection is required' };
      }
      const validPgOps = ['select', 'insert', 'update', 'delete', 'query'];
      const op = data?.operation || 'select';
      if (!validPgOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${op}". Supported: ${validPgOps.join(', ')}` };
      }
      if (op === 'query') {
        const sqlQuery = data?.query || data?.sql;
        if (!sqlQuery || !String(sqlQuery).trim()) {
          return { valid: false, error: 'SQL query is required for Raw SQL operation' };
        }
      } else {
        if (!data?.table?.trim()) {
          return { valid: false, error: `Table name is required for "${op}" operation` };
        }
        if (op === 'insert') {
          const val = data?.values ?? data?.data;
          const hasVal = typeof val === 'object' ? val && Object.keys(val).length > 0 : String(val || '').trim();
          if (!hasVal) {
            return { valid: false, error: 'Values / data are required for insert operation' };
          }
        }
        if (op === 'update') {
          const val = data?.values ?? data?.data;
          const hasVal = typeof val === 'object' ? val && Object.keys(val).length > 0 : String(val || '').trim();
          const filter = data?.filters ?? data?.where;
          const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
          if (!hasVal) {
            return { valid: false, error: 'Values / data are required for update operation' };
          }
          if (!hasFilter) {
            return { valid: false, error: 'Filters / WHERE condition is required for update operation' };
          }
        }
        if (op === 'delete') {
          const filter = data?.filters ?? data?.where;
          const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
          if (!hasFilter) {
            return { valid: false, error: 'Filters / WHERE condition is required for delete operation' };
          }
        }
      }
    }

    if (type === NodeTypes.ACTION_MONGODB) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'MongoDB connection is required' };
      }
      const validMongoOps = ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'deleteOne', 'count'];
      const op = data?.operation || 'find';
      if (!validMongoOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${op}". Supported: ${validMongoOps.join(', ')}` };
      }
      if (!data?.collection?.trim()) {
        return { valid: false, error: 'Collection name is required' };
      }
      if (op === 'insertOne') {
        const doc = data?.document ?? data?.data;
        const hasDoc = typeof doc === 'object' ? doc && Object.keys(doc).length > 0 : String(doc || '').trim();
        if (!hasDoc) {
          return { valid: false, error: 'Document data is required for insertOne' };
        }
      }
      if (op === 'insertMany') {
        const docs = data?.document ?? data?.data;
        const hasDocs = Array.isArray(docs) ? docs.length > 0 : String(docs || '').trim();
        if (!hasDocs) {
          return { valid: false, error: 'Documents array is required for insertMany' };
        }
      }
      if (op === 'updateOne') {
        const upd = data?.update ?? data?.document ?? data?.data;
        const hasUpd = typeof upd === 'object' ? upd && Object.keys(upd).length > 0 : String(upd || '').trim();
        const filter = data?.filter;
        const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
        if (!hasUpd) {
          return { valid: false, error: 'Update data is required for updateOne' };
        }
        if (!hasFilter) {
          return { valid: false, error: 'Filter is required for updateOne' };
        }
      }
      if (op === 'deleteOne') {
        const filter = data?.filter;
        const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
        if (!hasFilter) {
          return { valid: false, error: 'Filter is required for deleteOne' };
        }
      }
    }

    if (type === NodeTypes.ACTION_GOOGLE_SHEETS) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'Google Sheets connection is required' };
      }
      const targetSheet = data?.spreadsheet || data?.spreadsheetId;
      if (!targetSheet?.trim()) {
        return { valid: false, error: 'Spreadsheet ID or URL is required' };
      }
      const validOps = [
        'get_rows', 'getrows', 'get-rows',
        'get_row', 'getrow', 'get-row',
        'add_row', 'addrow', 'add-row', 'append',
        'update_row', 'updaterow', 'update-row',
        'delete_row', 'deleterow', 'delete-row',
        'find_row', 'findrow', 'find-row',
      ];
      const rawOp = data?.operation || 'get_rows';
      const opKey = String(rawOp).toLowerCase().replace(/[^a-z]/g, '');
      if (!validOps.map((o) => o.replace(/[^a-z]/g, '')).includes(opKey)) {
        return { valid: false, error: `Invalid operation "${rawOp}". Supported: Get Rows, Get Row, Add Row, Update Row, Delete Row, Find Row` };
      }
      if (opKey === 'getrow' || opKey === 'updaterow' || opKey === 'deleterow') {
        const rNum = data?.rowNumber;
        if (rNum === undefined || rNum === null || String(rNum).trim() === '') {
          return { valid: false, error: `Row number is required for ${rawOp} operation` };
        }
      }
      if (opKey === 'addrow' || opKey === 'append' || opKey === 'updaterow') {
        const val = data?.row ?? data?.values ?? data?.data;
        const hasVal = typeof val === 'object' ? (val && Object.keys(val).length > 0) : String(val || '').trim();
        if (!hasVal) {
          return { valid: false, error: `Row data/values are required for ${rawOp} operation` };
        }
      }
      if (opKey === 'findrow') {
        if (!data?.searchColumn?.trim()) {
          return { valid: false, error: 'Search column is required for Find Row operation' };
        }
        if (data?.searchValue === undefined || data?.searchValue === null || String(data?.searchValue).trim() === '') {
          return { valid: false, error: 'Search value is required for Find Row operation' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validates if a new condition edge connection is allowed
   * @param {object} params - Connection parameters { source, target, sourceHandle }
   * @param {Array} edges - Existing edge list
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateConditionConnection(params, edges) {
    if (params.sourceHandle === 'true' || params.sourceHandle === 'false') {
      const duplicate = edges.find(
        (e) => e.source === params.source && e.sourceHandle === params.sourceHandle
      );
      if (duplicate) {
        return {
          valid: false,
          error: `Condition node already has a ${params.sourceHandle.toUpperCase()} branch connection`,
        };
      }
    }
    return { valid: true };
  }
}

export default NodeValidator;

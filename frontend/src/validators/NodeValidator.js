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

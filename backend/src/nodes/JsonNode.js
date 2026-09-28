const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * JsonNode — JSON manipulation utility node.
 *
 * Supported operations:
 *   parse     — parse a JSON string into an object/array
 *   stringify — serialize an object/array into a JSON string
 *   get       — read a property/path from a JSON object
 *   set       — set or overwrite a property at a given path
 *   remove    — remove a property at a given path
 */
class JsonNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_JSON,
      name: 'JSON',
      category: 'action',
      icon: 'Braces',
      description: 'Parse, transform, and serialize JSON data',
      version: '1.0.0',
    });
  }

  validate(node) {
    const { operation } = node.data || {};
    const validOperations = ['parse', 'stringify', 'get', 'set', 'remove'];
    if (!operation || !validOperations.includes(operation)) {
      return { valid: false, error: `JSON operation is required. Supported: ${validOperations.join(', ')}` };
    }

    if (operation === 'parse') {
      if (!node.data?.input || !String(node.data.input).trim()) {
        return { valid: false, error: 'JSON "parse" requires an input value' };
      }
    }

    if (operation === 'get' || operation === 'set' || operation === 'remove') {
      if (!node.data?.path || !String(node.data.path).trim()) {
        return { valid: false, error: `JSON "${operation}" requires a property path` };
      }
    }

    if (operation === 'set') {
      // value can be empty string intentionally; only path is required
      if (!node.data?.path || !String(node.data.path).trim()) {
        return { valid: false, error: 'JSON "set" requires a property path' };
      }
    }

    return { valid: true };
  }

  /**
   * Get a nested value from an object using dot-notation path
   * @param {object} obj
   * @param {string} pathStr - e.g. "user.profile.email"
   * @returns {any}
   */
  _getPath(obj, pathStr) {
    if (obj === null || obj === undefined) return undefined;
    if (!pathStr || !String(pathStr).trim()) return obj;
    const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
    let cur = obj;
    for (const part of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  /**
   * Set a nested value on an object using dot-notation path (immutable — returns new object)
   * @param {object} obj
   * @param {string} pathStr
   * @param {any} value
   * @returns {object}
   */
  _setPath(obj, pathStr, value) {
    const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return value;

    const result = typeof obj === 'object' && obj !== null && !Array.isArray(obj) ? { ...obj } : {};
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      cur[part] = typeof cur[part] === 'object' && cur[part] !== null && !Array.isArray(cur[part])
        ? { ...cur[part] }
        : {};
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
    return result;
  }

  /**
   * Remove a nested property using dot-notation path (immutable — returns new object)
   * @param {object} obj
   * @param {string} pathStr
   * @returns {object}
   */
  _removePath(obj, pathStr) {
    const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return obj;

    const result = typeof obj === 'object' && obj !== null && !Array.isArray(obj) ? { ...obj } : {};
    if (parts.length === 1) {
      delete result[parts[0]];
      return result;
    }

    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof cur[part] !== 'object' || cur[part] === null) return result;
      cur[part] = Array.isArray(cur[part]) ? [...cur[part]] : { ...cur[part] };
      cur = cur[part];
    }
    delete cur[parts[parts.length - 1]];
    return result;
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const {
      operation,
      input = '',
      path = '',
      value = '',
      pretty = false,
    } = node.data || {};

    // Resolve variable expressions in input fields
    const resolvedInput = resolveVariable(input, context);
    const resolvedPath  = resolveVariable(path, context);
    const resolvedValue = resolveVariable(value, context);

    let resultData;

    try {
      switch (operation) {
        case 'parse': {
          // Accept already-parsed object from previous node, or a JSON string
          if (typeof resolvedInput === 'object' && resolvedInput !== null) {
            resultData = resolvedInput;
          } else {
            const str = String(resolvedInput ?? '').trim();
            if (!str) throw new NodeExecutionError('JSON "parse" received empty input', { nodeId: node.id });
            try {
              resultData = JSON.parse(str);
            } catch (e) {
              throw new NodeExecutionError(`JSON "parse" failed: invalid JSON — ${e.message}`, { nodeId: node.id });
            }
          }
          break;
        }

        case 'stringify': {
          // Accept string from context.lastOutput or explicit input
          const target = resolvedInput !== '' && resolvedInput !== null && resolvedInput !== undefined
            ? resolvedInput
            : context.lastOutput;
          const indent = pretty ? 2 : undefined;
          try {
            resultData = JSON.stringify(target, null, indent);
          } catch (e) {
            throw new NodeExecutionError(`JSON "stringify" failed: ${e.message}`, { nodeId: node.id });
          }
          break;
        }

        case 'get': {
          const source = resolvedInput !== '' && resolvedInput !== null && resolvedInput !== undefined
            ? resolvedInput
            : context.lastOutput;
          const parsed = typeof source === 'string' ? (() => { try { return JSON.parse(source); } catch { return source; } })() : source;
          resultData = this._getPath(parsed, resolvedPath);
          break;
        }

        case 'set': {
          const source = resolvedInput !== '' && resolvedInput !== null && resolvedInput !== undefined
            ? resolvedInput
            : context.lastOutput;
          const parsed = typeof source === 'string' ? (() => { try { return JSON.parse(source); } catch { return source; } })() : source;

          // Try to parse value as JSON if it looks like one
          let parsedValue = resolvedValue;
          if (typeof resolvedValue === 'string') {
            try { parsedValue = JSON.parse(resolvedValue); } catch { parsedValue = resolvedValue; }
          }

          resultData = this._setPath(parsed, resolvedPath, parsedValue);
          break;
        }

        case 'remove': {
          const source = resolvedInput !== '' && resolvedInput !== null && resolvedInput !== undefined
            ? resolvedInput
            : context.lastOutput;
          const parsed = typeof source === 'string' ? (() => { try { return JSON.parse(source); } catch { return source; } })() : source;
          resultData = this._removePath(parsed, resolvedPath);
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported JSON operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      if (err instanceof NodeExecutionError) throw err;
      throw new NodeExecutionError(`JSON "${operation}" failed: ${err.message}`, { nodeId: node.id, originalError: err });
    }

    return {
      data: resultData,
      operation,
    };
  }
}

module.exports = JsonNode;

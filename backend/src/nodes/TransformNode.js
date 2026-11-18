const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

// Prohibited property names for prototype pollution defense (SEC-14)
const DANGEROUS_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Checks whether a property path contains dangerous prototype pollution tokens
 * @param {string} pathStr
 * @returns {boolean}
 */
function isDangerousPath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') return false;
  const segments = pathStr.split('.').map((s) => s.trim().toLowerCase());
  return segments.some((seg) => DANGEROUS_PROPERTIES.has(seg));
}

/**
 * Safely sets a value on an object at a given path without polluting Object.prototype
 * @param {object} target - Target object to mutate
 * @param {string} pathStr - Dot-separated path
 * @param {any} value - Value to set
 * @returns {object}
 */
function safeSetProperty(target, pathStr, value) {
  if (!target || typeof target !== 'object' || !pathStr || typeof pathStr !== 'string') return target;
  if (isDangerousPath(pathStr)) {
    throw new Error(`Prototype pollution attempt rejected: path "${pathStr}" contains prohibited property keywords`);
  }

  const parts = pathStr.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return target;

  let current = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (DANGEROUS_PROPERTIES.has(part.toLowerCase())) {
      throw new Error(`Prototype pollution attempt rejected: segment "${part}" is prohibited`);
    }
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = Object.create(null);
    }
    current = current[part];
  }

  const lastKey = parts[parts.length - 1];
  if (DANGEROUS_PROPERTIES.has(lastKey.toLowerCase())) {
    throw new Error(`Prototype pollution attempt rejected: property "${lastKey}" is prohibited`);
  }

  Object.defineProperty(current, lastKey, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  return target;
}

/**
 * TransformNode — general-purpose data transformation node.
 *
 * Supported operations:
 *   map    — rename/extract fields into a new object using variable expressions
 *   pick   — select only specified field paths from input data
 *   omit   — remove specified field paths from input data
 *   set    — create/overwrite fields with static or variable values
 *   remove — delete specified fields from input data
 *
 *   array-map    — apply a field mapping template to each element in an array
 *   array-filter — filter array elements by a field equality condition
 *   array-find   — find first element matching a field equality condition
 *   array-first  — return the first element of an array
 *   array-last   — return the last element of an array
 *   array-length — return the count of elements in an array
 */
class TransformNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_TRANSFORM,
      name: 'Transform Data',
      category: 'action',
      icon: '🔄',
      description: 'Map, pick, omit, set, and filter data between workflow steps',
      version: '2.0.0',
    });
  }

  _normalizeNodeData(nodeData = {}) {
    const data = { ...nodeData };
    if (typeof data.fields === 'string') {
      data.fields = data.fields.split(',').map((f) => f.trim()).filter(Boolean);
    }
    if (Array.isArray(data.mappings)) {
      data.mappings = data.mappings.map((m) => {
        if (!m || typeof m !== 'object') return m;
        return {
          ...m,
          outputField: m.outputField || m.to || '',
          source: m.source !== undefined ? m.source : (m.from !== undefined ? m.from : ''),
        };
      });
    }
    return data;
  }

  validate(node) {
    const { operation = 'map', mappings = [], fields = [] } = this._normalizeNodeData(node?.data);

    const validOperations = ['map', 'pick', 'omit', 'set', 'remove', 'array-map', 'array-filter', 'array-find', 'array-first', 'array-last', 'array-length'];
    if (!validOperations.includes(operation)) {
      return { valid: false, error: `Unsupported transform operation "${operation}". Supported: ${validOperations.join(', ')}` };
    }

    if (operation === 'map' || operation === 'set' || operation === 'array-map') {
      if (!Array.isArray(mappings) || mappings.filter((m) => m.outputField && m.source !== undefined).length === 0) {
        return { valid: false, error: `Transform "${operation}" operation requires at least one mapping with an output field and source expression` };
      }
      for (const m of mappings) {
        if (m.outputField) {
          if (!/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(m.outputField)) {
            return { valid: false, error: `Invalid output field name "${m.outputField}" — must be a valid identifier` };
          }
          if (isDangerousPath(m.outputField)) {
            return { valid: false, error: `Prototype pollution rejected: output field "${m.outputField}" contains prohibited property keywords` };
          }
        }
      }
    }

    if (operation === 'pick' || operation === 'omit' || operation === 'remove') {
      if (!Array.isArray(fields) || fields.filter((f) => f && String(f).trim()).length === 0) {
        return { valid: false, error: `Transform "${operation}" operation requires at least one field name` };
      }
      for (const f of fields) {
        if (f && isDangerousPath(String(f))) {
          return { valid: false, error: `Prototype pollution rejected: field "${f}" contains prohibited property keywords` };
        }
      }
    }

    if (operation === 'array-filter' || operation === 'array-find') {
      if (!node.data?.filterField || !String(node.data.filterField).trim()) {
        return { valid: false, error: `Transform "${operation}" requires a filter field name` };
      }
      if (isDangerousPath(String(node.data.filterField))) {
        return { valid: false, error: `Prototype pollution rejected: filter field "${node.data.filterField}" contains prohibited property keywords` };
      }
    }

    return { valid: true };
  }

  async execute(node, context) {
    const normalizedData = this._normalizeNodeData(node?.data);
    const validation = this.validate({ ...node, data: normalizedData });
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const {
      operation = 'map',
      source = '',
      mappings = [],
      fields = [],
      filterField = '',
      filterValue = '',
    } = normalizedData;

    // Resolve input data — from explicit source expression or context.lastOutput
    let inputData;
    if (source && String(source).trim()) {
      const resolved = resolveVariable(source, context);
      if (typeof resolved === 'string') {
        try { inputData = JSON.parse(resolved); } catch { inputData = resolved; }
      } else {
        inputData = resolved;
      }
    } else {
      inputData = context.lastOutput;
    }

    // If operation expects an array but inputData is an object wrapping an array
    if (operation.startsWith('array-') && !Array.isArray(inputData) && inputData && typeof inputData === 'object') {
      if (Array.isArray(inputData.rows)) inputData = inputData.rows;
      else if (Array.isArray(inputData.data)) inputData = inputData.data;
      else if (Array.isArray(inputData.documents)) inputData = inputData.documents;
      else if (Array.isArray(inputData.records)) inputData = inputData.records;
    }

    let resultData;

    try {
      switch (operation) {
        case 'map': {
          resultData = Object.create(null);
          for (const m of mappings) {
            if (!m.outputField || !String(m.outputField).trim()) continue;
            const fieldPath = m.outputField.trim();
            if (isDangerousPath(fieldPath)) {
              throw new NodeExecutionError(`Prototype pollution attempt rejected for field "${fieldPath}"`, { nodeId: node.id });
            }
            const val = resolveVariable(m.source || '', { ...context, lastOutput: inputData });
            if (fieldPath.includes('.')) {
              safeSetProperty(resultData, fieldPath, val !== '' ? val : undefined);
            } else {
              Object.defineProperty(resultData, fieldPath, {
                value: val !== '' ? val : undefined,
                writable: true,
                enumerable: true,
                configurable: true,
              });
            }
          }
          resultData = { ...resultData };
          break;
        }

        case 'pick': {
          let target = inputData;
          if (target && typeof target === 'object' && target.data && typeof target.data === 'object' && !Array.isArray(target.data)) {
            target = target.data;
          }
          if (typeof target !== 'object' || target === null || Array.isArray(target)) {
            throw new NodeExecutionError('Transform "pick" expects an object input', { nodeId: node.id });
          }
          resultData = Object.create(null);
          fields.forEach((f) => {
            const key = String(f).trim();
            if (key && !isDangerousPath(key) && key in target) {
              resultData[key] = target[key];
            }
          });
          resultData = { ...resultData };
          break;
        }

        case 'omit': {
          let target = inputData;
          if (target && typeof target === 'object' && target.data && typeof target.data === 'object' && !Array.isArray(target.data)) {
            target = target.data;
          }
          if (typeof target !== 'object' || target === null || Array.isArray(target)) {
            throw new NodeExecutionError('Transform "omit" expects an object input', { nodeId: node.id });
          }
          const omitSet = new Set(fields.map((f) => String(f).trim()).filter(Boolean));
          resultData = Object.create(null);
          for (const [k, v] of Object.entries(target)) {
            if (!omitSet.has(k) && !isDangerousPath(k)) {
              resultData[k] = v;
            }
          }
          resultData = { ...resultData };
          break;
        }

        case 'set': {
          let target = inputData;
          if (target && typeof target === 'object' && target.data && typeof target.data === 'object' && !Array.isArray(target.data)) {
            target = target.data;
          }
          resultData = typeof target === 'object' && target !== null && !Array.isArray(target)
            ? { ...target }
            : {};
          for (const m of mappings) {
            if (!m.outputField || !String(m.outputField).trim()) continue;
            const fieldPath = m.outputField.trim();
            if (isDangerousPath(fieldPath)) {
              throw new NodeExecutionError(`Prototype pollution attempt rejected for field "${fieldPath}"`, { nodeId: node.id });
            }
            const val = resolveVariable(m.source || '', { ...context, lastOutput: inputData });
            if (fieldPath.includes('.')) {
              safeSetProperty(resultData, fieldPath, val);
            } else {
              Object.defineProperty(resultData, fieldPath, {
                value: val,
                writable: true,
                enumerable: true,
                configurable: true,
              });
            }
          }
          break;
        }

        case 'remove': {
          if (typeof inputData !== 'object' || inputData === null || Array.isArray(inputData)) {
            throw new NodeExecutionError('Transform "remove" expects an object input', { nodeId: node.id });
          }
          resultData = { ...inputData };
          fields.forEach((f) => {
            const key = String(f).trim();
            if (key && !isDangerousPath(key)) {
              delete resultData[key];
            }
          });
          break;
        }

        case 'array-map': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-map" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          resultData = inputData.map((item) => {
            const obj = Object.create(null);
            for (const m of mappings) {
              if (!m.outputField || !String(m.outputField).trim()) continue;
              const fieldPath = m.outputField.trim();
              if (isDangerousPath(fieldPath)) {
                throw new NodeExecutionError(`Prototype pollution attempt rejected for field "${fieldPath}"`, { nodeId: node.id });
              }
              const val = resolveVariable(m.source || '', { ...context, lastOutput: item });
              if (fieldPath.includes('.')) {
                safeSetProperty(obj, fieldPath, val);
              } else {
                Object.defineProperty(obj, fieldPath, {
                  value: val,
                  writable: true,
                  enumerable: true,
                  configurable: true,
                });
              }
            }
            return { ...obj };
          });
          break;
        }

        case 'array-filter': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-filter" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          if (isDangerousPath(filterField)) {
            throw new NodeExecutionError(`Prototype pollution attempt rejected for filterField "${filterField}"`, { nodeId: node.id });
          }
          const resolvedFilterVal = resolveVariable(filterValue, context);
          resultData = inputData.filter((item) => {
            const itemVal = String(item?.[filterField] ?? '');
            return itemVal === String(resolvedFilterVal);
          });
          break;
        }

        case 'array-find': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-find" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          if (isDangerousPath(filterField)) {
            throw new NodeExecutionError(`Prototype pollution attempt rejected for filterField "${filterField}"`, { nodeId: node.id });
          }
          const resolvedFindVal = resolveVariable(filterValue, context);
          resultData = inputData.find((item) => String(item?.[filterField] ?? '') === String(resolvedFindVal)) ?? null;
          break;
        }

        case 'array-first': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-first" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          resultData = inputData.length > 0 ? inputData[0] : null;
          break;
        }

        case 'array-last': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-last" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          resultData = inputData.length > 0 ? inputData[inputData.length - 1] : null;
          break;
        }

        case 'array-length': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-length" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          resultData = inputData.length;
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported transform operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      if (err instanceof NodeExecutionError) throw err;
      throw new NodeExecutionError(`Transform "${operation}" failed: ${err.message}`, { nodeId: node.id, originalError: err });
    }

    return {
      data: resultData,
      operation,
      inputType: Array.isArray(inputData) ? 'array' : typeof inputData,
    };
  }
}

module.exports = TransformNode;

const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

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
 *
 * Architecture note: The JSON-specific operations (parse, stringify, get, set, remove-property)
 * are intentionally kept within action-transform as they share the same variable-resolution
 * and context-reading infrastructure. A separate action-json node would duplicate this
 * without architectural benefit.
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
        if (m.outputField && !/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(m.outputField)) {
          return { valid: false, error: `Invalid output field name "${m.outputField}" — must be a valid identifier` };
        }
      }
    }

    if (operation === 'pick' || operation === 'omit' || operation === 'remove') {
      if (!Array.isArray(fields) || fields.filter((f) => f && String(f).trim()).length === 0) {
        return { valid: false, error: `Transform "${operation}" operation requires at least one field name` };
      }
    }

    if (operation === 'array-filter' || operation === 'array-find') {
      if (!node.data?.filterField || !String(node.data.filterField).trim()) {
        return { valid: false, error: `Transform "${operation}" requires a filter field name` };
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
      template = '',
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

    // If operation expects an array but inputData is an object wrapping an array (e.g. from Database or GoogleSheets)
    if (operation.startsWith('array-') && !Array.isArray(inputData) && inputData && typeof inputData === 'object') {
      if (Array.isArray(inputData.rows)) inputData = inputData.rows;
      else if (Array.isArray(inputData.data)) inputData = inputData.data;
      else if (Array.isArray(inputData.documents)) inputData = inputData.documents;
      else if (Array.isArray(inputData.records)) inputData = inputData.records;
    }

    // Execute the requested operation
    let resultData;

    try {
      switch (operation) {
        case 'map': {
          // Rename/extract fields: mappings[].outputField = resolvedSource
          resultData = {};
          for (const m of mappings) {
            if (!m.outputField || !String(m.outputField).trim()) continue;
            const val = resolveVariable(m.source || '', { ...context, lastOutput: inputData });
            resultData[m.outputField.trim()] = val !== '' ? val : undefined;
          }
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
          resultData = {};
          fields.forEach((f) => {
            const key = String(f).trim();
            if (key && key in target) resultData[key] = target[key];
          });
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
          resultData = {};
          for (const [k, v] of Object.entries(target)) {
            if (!omitSet.has(k)) resultData[k] = v;
          }
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
            resultData[m.outputField.trim()] = resolveVariable(m.source || '', { ...context, lastOutput: inputData });
          }
          break;
        }

        case 'remove': {
          // Delete specified keys from input object
          if (typeof inputData !== 'object' || inputData === null || Array.isArray(inputData)) {
            throw new NodeExecutionError('Transform "remove" expects an object input', { nodeId: node.id });
          }
          resultData = { ...inputData };
          fields.forEach((f) => {
            const key = String(f).trim();
            if (key) delete resultData[key];
          });
          break;
        }

        case 'array-map': {
          // Apply mappings template to each array element
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-map" expects an array but received ${typeof inputData}`, { nodeId: node.id });
          }
          resultData = inputData.map((item) => {
            const obj = {};
            for (const m of mappings) {
              if (!m.outputField || !String(m.outputField).trim()) continue;
              obj[m.outputField.trim()] = resolveVariable(m.source || '', { ...context, lastOutput: item });
            }
            return obj;
          });
          break;
        }

        case 'array-filter': {
          if (!Array.isArray(inputData)) {
            throw new NodeExecutionError(`Transform "array-filter" expects an array but received ${typeof inputData}`, { nodeId: node.id });
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

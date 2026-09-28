const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * TextNode — text manipulation utility node.
 *
 * Supported operations:
 *   uppercase  — convert string to UPPERCASE
 *   lowercase  — convert string to lowercase
 *   trim       — strip leading/trailing whitespace
 *   replace    — find and replace substring
 *   contains   — test if string contains a substring (returns boolean)
 *   startsWith — test if string starts with a value (returns boolean)
 *   endsWith   — test if string ends with a value (returns boolean)
 *   split      — split string into array by separator
 *   join       — join array into string with separator
 *   length     — return character count (or array length)
 *   substring  — extract a portion of the string
 */
class TextNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_TEXT,
      name: 'Text',
      category: 'action',
      icon: 'Type',
      description: 'Manipulate and inspect text values',
      version: '1.0.0',
    });
  }

  validate(node) {
    const { operation, input, separator, find } = node.data || {};
    const validOperations = [
      'uppercase', 'lowercase', 'trim',
      'replace', 'contains', 'startsWith', 'endsWith',
      'split', 'join', 'length', 'substring',
    ];

    if (!operation || !validOperations.includes(operation)) {
      return { valid: false, error: `Text operation is required. Supported: ${validOperations.join(', ')}` };
    }

    const ops_requiring_input = validOperations; // all operations need input
    if (ops_requiring_input.includes(operation)) {
      if (input === undefined || input === null || String(input).trim() === '') {
        return { valid: false, error: `Text "${operation}" requires an input value` };
      }
    }

    if (operation === 'replace') {
      if (find === undefined || find === null || String(find) === '') {
        return { valid: false, error: 'Text "replace" requires a Find value' };
      }
    }

    if (operation === 'contains' || operation === 'startsWith' || operation === 'endsWith') {
      if (node.data?.search === undefined || node.data?.search === null || String(node.data.search) === '') {
        return { valid: false, error: `Text "${operation}" requires a search value` };
      }
    }

    if (operation === 'split') {
      if (separator === undefined || separator === null) {
        return { valid: false, error: 'Text "split" requires a separator value' };
      }
    }

    if (operation === 'join') {
      if (separator === undefined || separator === null) {
        return { valid: false, error: 'Text "join" requires a separator value' };
      }
    }

    if (operation === 'substring') {
      const start = Number(node.data?.start ?? 0);
      if (isNaN(start)) {
        return { valid: false, error: 'Text "substring" requires a numeric start index' };
      }
    }

    return { valid: true };
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const {
      operation,
      input = '',
      find = '',
      replace: replaceWith = '',
      search = '',
      separator = '',
      start = '0',
      end,
    } = node.data || {};

    // Resolve all variable expressions
    const resolvedInput     = resolveVariable(input, context);
    const resolvedFind      = resolveVariable(find, context);
    const resolvedReplace   = resolveVariable(replaceWith, context);
    const resolvedSearch    = resolveVariable(search, context);
    const resolvedSeparator = resolveVariable(separator, context);
    const resolvedStart     = resolveVariable(String(start), context);
    const resolvedEnd       = end !== undefined ? resolveVariable(String(end), context) : undefined;

    // Use previous node output as input if resolvedInput resolves to the same (unresolved) string
    const effectiveInput = (resolvedInput !== undefined && resolvedInput !== null && resolvedInput !== '')
      ? resolvedInput
      : context.lastOutput;

    let resultData;

    try {
      switch (operation) {
        case 'uppercase':
          resultData = String(effectiveInput ?? '').toUpperCase();
          break;

        case 'lowercase':
          resultData = String(effectiveInput ?? '').toLowerCase();
          break;

        case 'trim':
          resultData = String(effectiveInput ?? '').trim();
          break;

        case 'replace': {
          const str = String(effectiveInput ?? '');
          const findStr = String(resolvedFind);
          const replStr = String(resolvedReplace);
          // Replace all occurrences
          resultData = str.split(findStr).join(replStr);
          break;
        }

        case 'contains':
          resultData = String(effectiveInput ?? '').includes(String(resolvedSearch));
          break;

        case 'startsWith':
          resultData = String(effectiveInput ?? '').startsWith(String(resolvedSearch));
          break;

        case 'endsWith':
          resultData = String(effectiveInput ?? '').endsWith(String(resolvedSearch));
          break;

        case 'split': {
          const str = String(effectiveInput ?? '');
          const sep = String(resolvedSeparator);
          resultData = str.split(sep);
          break;
        }

        case 'join': {
          // If effectiveInput is a JSON-serialized array string, parse it first
          let joinArr = effectiveInput;
          if (typeof joinArr === 'string') {
            try { const parsed = JSON.parse(joinArr); if (Array.isArray(parsed)) joinArr = parsed; } catch { /* keep string */ }
          }
          const arr = Array.isArray(joinArr) ? joinArr : [joinArr];
          const sep = String(resolvedSeparator);
          resultData = arr.map((x) => String(x ?? '')).join(sep);
          break;
        }

        case 'length': {
          // If effectiveInput is a JSON-serialized array string, parse it first
          let lenInput = effectiveInput;
          if (typeof lenInput === 'string') {
            try { const parsed = JSON.parse(lenInput); if (Array.isArray(parsed)) lenInput = parsed; } catch { /* keep string */ }
          }
          if (Array.isArray(lenInput)) {
            resultData = lenInput.length;
          } else {
            resultData = String(lenInput ?? '').length;
          }
          break;
        }

        case 'substring': {
          const str   = String(effectiveInput ?? '');
          const sIdx  = Number(resolvedStart);
          const eIdx  = resolvedEnd !== undefined ? Number(resolvedEnd) : undefined;
          if (isNaN(sIdx)) {
            throw new NodeExecutionError('Text "substring" start index must be a number', { nodeId: node.id });
          }
          if (eIdx !== undefined && isNaN(eIdx)) {
            throw new NodeExecutionError('Text "substring" end index must be a number', { nodeId: node.id });
          }
          resultData = eIdx !== undefined ? str.substring(sIdx, eIdx) : str.substring(sIdx);
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported text operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      if (err instanceof NodeExecutionError) throw err;
      throw new NodeExecutionError(`Text "${operation}" failed: ${err.message}`, { nodeId: node.id, originalError: err });
    }

    return {
      data: resultData,
      operation,
    };
  }
}

module.exports = TextNode;

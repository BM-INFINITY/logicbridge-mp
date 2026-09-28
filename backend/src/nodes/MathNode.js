const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * MathNode — arithmetic and numeric utility node.
 *
 * Supported operations:
 *   add        — a + b
 *   subtract   — a - b
 *   multiply   — a * b
 *   divide     — a / b  (division by zero throws NodeExecutionError)
 *   modulo     — a % b
 *   round      — Math.round(a)
 *   floor      — Math.floor(a)
 *   ceil       — Math.ceil(a)
 *   absolute   — Math.abs(a)
 *   min        — Math.min(a, b)
 *   max        — Math.max(a, b)
 *   percentage — (a / b) * 100
 */
class MathNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_MATH,
      name: 'Math',
      category: 'action',
      icon: 'Calculator',
      description: 'Perform calculations on numeric values',
      version: '1.0.0',
    });
  }

  /**
   * Operations requiring only operand A (unary)
   */
  static get UNARY_OPS() {
    return ['round', 'floor', 'ceil', 'absolute'];
  }

  /**
   * Operations requiring both operands A and B (binary)
   */
  static get BINARY_OPS() {
    return ['add', 'subtract', 'multiply', 'divide', 'modulo', 'min', 'max', 'percentage'];
  }

  static get ALL_OPS() {
    return [...MathNode.UNARY_OPS, ...MathNode.BINARY_OPS];
  }

  validate(node) {
    const { operation, valueA, valueB } = node.data || {};

    if (!operation || !MathNode.ALL_OPS.includes(operation)) {
      return { valid: false, error: `Math operation is required. Supported: ${MathNode.ALL_OPS.join(', ')}` };
    }

    if (valueA === undefined || valueA === null || String(valueA).trim() === '') {
      return { valid: false, error: `Math "${operation}" requires Value A` };
    }

    if (MathNode.BINARY_OPS.includes(operation)) {
      if (valueB === undefined || valueB === null || String(valueB).trim() === '') {
        return { valid: false, error: `Math "${operation}" requires Value B` };
      }
    }

    return { valid: true };
  }

  /**
   * Parse and validate a numeric value, rejecting non-numeric strings
   * @param {any} raw - Raw value (may be a variable expression result)
   * @param {string} label - Human-readable label for error messages
   * @param {string} nodeId - For NodeExecutionError context
   * @returns {number}
   */
  _parseNumber(raw, label, nodeId) {
    if (raw === null || raw === undefined) {
      throw new NodeExecutionError(`Math: ${label} is null or undefined`, { nodeId });
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new NodeExecutionError(`Math: ${label} "${raw}" is not a valid number`, { nodeId });
    }
    return n;
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const { operation, valueA = '', valueB = '' } = node.data || {};

    // Resolve variable expressions
    const rawA = resolveVariable(String(valueA), context);
    const rawB = MathNode.BINARY_OPS.includes(operation)
      ? resolveVariable(String(valueB), context)
      : null;

    const a = this._parseNumber(rawA, 'Value A', node.id);
    const b = MathNode.BINARY_OPS.includes(operation)
      ? this._parseNumber(rawB, 'Value B', node.id)
      : null;

    let resultData;

    switch (operation) {
      case 'add':
        resultData = a + b;
        break;
      case 'subtract':
        resultData = a - b;
        break;
      case 'multiply':
        resultData = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new NodeExecutionError('Math "divide": division by zero is not allowed', { nodeId: node.id });
        }
        resultData = a / b;
        break;
      case 'modulo':
        if (b === 0) {
          throw new NodeExecutionError('Math "modulo": modulo by zero is not allowed', { nodeId: node.id });
        }
        resultData = a % b;
        break;
      case 'round':
        resultData = Math.round(a);
        break;
      case 'floor':
        resultData = Math.floor(a);
        break;
      case 'ceil':
        resultData = Math.ceil(a);
        break;
      case 'absolute':
        resultData = Math.abs(a);
        break;
      case 'min':
        resultData = Math.min(a, b);
        break;
      case 'max':
        resultData = Math.max(a, b);
        break;
      case 'percentage':
        if (b === 0) {
          throw new NodeExecutionError('Math "percentage": denominator (Value B) cannot be zero', { nodeId: node.id });
        }
        resultData = (a / b) * 100;
        break;
      default:
        throw new NodeExecutionError(`Unsupported math operation: "${operation}"`, { nodeId: node.id });
    }

    return {
      data: resultData,
      operation,
      operandA: a,
      ...(b !== null && { operandB: b }),
    };
  }
}

module.exports = MathNode;

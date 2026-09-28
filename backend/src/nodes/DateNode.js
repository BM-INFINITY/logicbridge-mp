const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * DateNode — date and time utility node.
 *
 * Supported operations:
 *   now        — return the current execution timestamp (ISO-8601)
 *   parse      — parse a date string into a Date object (returns ISO string)
 *   format     — format a date using a format pattern
 *   add        — add time units to a date
 *   subtract   — subtract time units from a date
 *   compare    — compare two dates (returns "before" | "equal" | "after")
 *   difference — return numeric difference between two dates in a given unit
 *
 * Timezone note:
 *   All operations work in UTC internally. Dates are parsed according to the
 *   ISO-8601 spec. Supplying a timezone offset in the input (e.g. +05:30) is
 *   preserved correctly by the native Date constructor. Output is always an
 *   ISO-8601 string unless specified otherwise.
 *
 * Date library:
 *   Uses the built-in Node.js Date object. No external library added.
 */
class DateNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_DATE,
      name: 'Date & Time',
      category: 'action',
      icon: 'Calendar',
      description: 'Parse, format, compare, and manipulate dates and times',
      version: '1.0.0',
    });
  }

  static get ALL_OPS() {
    return ['now', 'parse', 'format', 'add', 'subtract', 'compare', 'difference'];
  }

  static get TIME_UNITS() {
    return ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
  }

  validate(node) {
    const { operation, dateInput, amount, unit, dateA, dateB, outputUnit } = node.data || {};

    if (!operation || !DateNode.ALL_OPS.includes(operation)) {
      return { valid: false, error: `Date operation is required. Supported: ${DateNode.ALL_OPS.join(', ')}` };
    }

    // Operations that require a date input
    const needsDateInput = ['parse', 'format', 'add', 'subtract'];
    if (needsDateInput.includes(operation)) {
      if (!dateInput || !String(dateInput).trim()) {
        return { valid: false, error: `Date "${operation}" requires a date input value` };
      }
    }

    // Operations that require amount + unit
    if (operation === 'add' || operation === 'subtract') {
      if (amount === undefined || amount === null || String(amount).trim() === '') {
        return { valid: false, error: `Date "${operation}" requires an amount` };
      }
      if (!unit || !DateNode.TIME_UNITS.includes(unit)) {
        return { valid: false, error: `Date "${operation}" requires a valid time unit: ${DateNode.TIME_UNITS.join(', ')}` };
      }
    }

    if (operation === 'compare' || operation === 'difference') {
      if (!dateA || !String(dateA).trim()) {
        return { valid: false, error: `Date "${operation}" requires Date A` };
      }
      if (!dateB || !String(dateB).trim()) {
        return { valid: false, error: `Date "${operation}" requires Date B` };
      }
    }

    if (operation === 'difference') {
      const diffUnits = ['milliseconds', 'seconds', 'minutes', 'hours', 'days'];
      if (!outputUnit || !diffUnits.includes(outputUnit)) {
        return { valid: false, error: `Date "difference" requires an output unit: ${diffUnits.join(', ')}` };
      }
    }

    return { valid: true };
  }

  /**
   * Parse a date value — accepts ISO strings, timestamps, or Date objects.
   * Throws NodeExecutionError on invalid input.
   * @param {any} raw
   * @param {string} label - For error messages
   * @param {string} nodeId
   * @returns {Date}
   */
  _parseDate(raw, label, nodeId) {
    if (!raw && raw !== 0) {
      throw new NodeExecutionError(`Date: ${label} is empty or missing`, { nodeId });
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) {
      throw new NodeExecutionError(`Date: ${label} "${raw}" is not a valid date`, { nodeId });
    }
    return d;
  }

  /**
   * Convert milliseconds to the specified unit
   */
  _msToUnit(ms, unit) {
    switch (unit) {
      case 'milliseconds': return ms;
      case 'seconds':      return ms / 1000;
      case 'minutes':      return ms / (1000 * 60);
      case 'hours':        return ms / (1000 * 60 * 60);
      case 'days':         return ms / (1000 * 60 * 60 * 24);
      default: return ms;
    }
  }

  /**
   * Add or subtract a time amount from a Date object.
   * Returns a new Date.
   * @param {Date} date
   * @param {number} amount - Can be negative for subtract
   * @param {string} unit
   * @returns {Date}
   */
  _addTime(date, amount, unit) {
    const d = new Date(date.getTime());
    switch (unit) {
      case 'milliseconds': d.setTime(d.getTime() + amount); break;
      case 'seconds':      d.setTime(d.getTime() + amount * 1000); break;
      case 'minutes':      d.setTime(d.getTime() + amount * 60 * 1000); break;
      case 'hours':        d.setTime(d.getTime() + amount * 60 * 60 * 1000); break;
      case 'days':         d.setTime(d.getTime() + amount * 24 * 60 * 60 * 1000); break;
      case 'weeks':        d.setTime(d.getTime() + amount * 7 * 24 * 60 * 60 * 1000); break;
      case 'months': {
        const targetMonth = d.getMonth() + amount;
        d.setMonth(targetMonth);
        break;
      }
      case 'years':
        d.setFullYear(d.getFullYear() + amount);
        break;
    }
    return d;
  }

  /**
   * Format a Date using a simple format pattern.
   * Supported tokens: YYYY MM DD HH mm ss
   * For full strftime-style formatting, we use simple replacements.
   * @param {Date} date
   * @param {string} format - e.g. "YYYY-MM-DD HH:mm:ss"
   * @returns {string}
   */
  _formatDate(date, format) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return format
      .replace('YYYY', date.getUTCFullYear())
      .replace('MM', pad(date.getUTCMonth() + 1))
      .replace('DD', pad(date.getUTCDate()))
      .replace('HH', pad(date.getUTCHours()))
      .replace('mm', pad(date.getUTCMinutes()))
      .replace('ss', pad(date.getUTCSeconds()))
      .replace('SSS', pad(date.getUTCMilliseconds(), 3));
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const {
      operation,
      dateInput = '',
      dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      amount = '0',
      unit = 'days',
      dateA = '',
      dateB = '',
      outputUnit = 'days',
    } = node.data || {};

    // Resolve variable expressions
    const resolvedDateInput = resolveVariable(dateInput, context);
    const resolvedDateFormat = resolveVariable(dateFormat, context) || 'YYYY-MM-DDTHH:mm:ss.SSSZ';
    const resolvedAmount     = resolveVariable(String(amount), context);
    const resolvedDateA      = resolveVariable(dateA, context);
    const resolvedDateB      = resolveVariable(dateB, context);

    let resultData;

    try {
      switch (operation) {
        case 'now': {
          resultData = new Date().toISOString();
          break;
        }

        case 'parse': {
          const d = this._parseDate(resolvedDateInput, 'date input', node.id);
          resultData = d.toISOString();
          break;
        }

        case 'format': {
          const d = this._parseDate(resolvedDateInput, 'date input', node.id);
          // Support ISO output shorthand
          if (!resolvedDateFormat || resolvedDateFormat === 'ISO' || resolvedDateFormat === 'YYYY-MM-DDTHH:mm:ss.SSSZ') {
            resultData = d.toISOString();
          } else {
            resultData = this._formatDate(d, resolvedDateFormat);
          }
          break;
        }

        case 'add': {
          const d = this._parseDate(resolvedDateInput, 'date input', node.id);
          const n = Number(resolvedAmount);
          if (isNaN(n)) {
            throw new NodeExecutionError(`Date "add": amount "${resolvedAmount}" is not a valid number`, { nodeId: node.id });
          }
          resultData = this._addTime(d, n, unit).toISOString();
          break;
        }

        case 'subtract': {
          const d = this._parseDate(resolvedDateInput, 'date input', node.id);
          const n = Number(resolvedAmount);
          if (isNaN(n)) {
            throw new NodeExecutionError(`Date "subtract": amount "${resolvedAmount}" is not a valid number`, { nodeId: node.id });
          }
          resultData = this._addTime(d, -n, unit).toISOString();
          break;
        }

        case 'compare': {
          const dA = this._parseDate(resolvedDateA, 'Date A', node.id);
          const dB = this._parseDate(resolvedDateB, 'Date B', node.id);
          const diff = dA.getTime() - dB.getTime();
          if (diff < 0) resultData = 'before';
          else if (diff === 0) resultData = 'equal';
          else resultData = 'after';
          break;
        }

        case 'difference': {
          const dA = this._parseDate(resolvedDateA, 'Date A', node.id);
          const dB = this._parseDate(resolvedDateB, 'Date B', node.id);
          const diffMs = dA.getTime() - dB.getTime();
          resultData = this._msToUnit(diffMs, outputUnit);
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported date operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      if (err instanceof NodeExecutionError) throw err;
      throw new NodeExecutionError(`Date "${operation}" failed: ${err.message}`, { nodeId: node.id, originalError: err });
    }

    return {
      data: resultData,
      operation,
    };
  }
}

module.exports = DateNode;

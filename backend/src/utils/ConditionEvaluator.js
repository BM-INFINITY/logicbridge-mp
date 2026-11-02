/**
 * ConditionEvaluator — Core evaluation engine for advanced conditions,
 * nested AND/OR groups, and Switch/Router matching rules.
 *
 * Supports:
 *   - Type-aware equality, inequality, and ordering (strings, numbers, booleans, dates, arrays, objects)
 *   - String and collection operators (contains, starts_with, ends_with)
 *   - Existence and emptiness checks (exists, does_not_exist, is_empty, is_not_empty, is_true, is_false)
 *   - Safe Regular Expression matching with ReDoS defenses
 *   - Nested condition groups with AND/OR combinators
 *   - Dynamic variable resolution preserving native types via resolveRawValue
 */

const { resolveVariable, resolveRawValue } = require('./VariableResolver');

// Known ReDoS exponential backtracking patterns (nested quantifiers)
const REDOS_PATTERNS = [
  /\((?:[^()]+)\+\)\+/,      // (a+)+
  /\((?:[^()]+)\*\)\*/,      // (a*)*
  /\((?:[^()]+)\+\)\*/,      // (a+)*
  /\((?:[^()]+)\*\)\+/,      // (a*)+
  /\(([^()|]+)\|\1\)\+/,     // (a|a)+
];

const MAX_REGEX_PATTERN_LENGTH = 300;
const MAX_REGEX_INPUT_LENGTH = 20000;

/**
 * Performs deep equality comparison between two values
 */
function deepEquals(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;

  if (typeof a !== typeof b) {
    // Number vs string coercion
    if (typeof a === 'number' && typeof b === 'string' && !isNaN(Number(b)) && b.trim() !== '') {
      return a === Number(b);
    }
    if (typeof a === 'string' && typeof b === 'number' && !isNaN(Number(a)) && a.trim() !== '') {
      return Number(a) === b;
    }
    // Boolean vs string coercion
    if (typeof a === 'boolean' && typeof b === 'string') {
      return a === (b.toLowerCase() === 'true');
    }
    if (typeof a === 'string' && typeof b === 'boolean') {
      return (a.toLowerCase() === 'true') === b;
    }
    return false;
  }

  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEquals(a[k], b[k])) return false;
  }

  return true;
}

/**
 * Checks if a value is considered empty
 */
function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
}

/**
 * Checks boolean truthiness with string coercion
 */
function isTruthy(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  if (typeof val === 'number') return val !== 0;
  return Boolean(val);
}

/**
 * Safely executes a regular expression against an input string with ReDoS mitigation
 */
function safeRegexMatch(input, pattern, flags = '') {
  if (typeof pattern !== 'string' || !pattern) {
    throw new Error('Regex pattern must be a non-empty string');
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new Error(`Regex pattern exceeds maximum length of ${MAX_REGEX_PATTERN_LENGTH} characters`);
  }

  for (const redosCheck of REDOS_PATTERNS) {
    if (redosCheck.test(pattern)) {
      throw new Error(`Security Error: Regex pattern "${pattern}" rejected due to potential catastrophic backtracking`);
    }
  }

  const strInput = String(input ?? '');
  if (strInput.length > MAX_REGEX_INPUT_LENGTH) {
    throw new Error(`Input length (${strInput.length}) exceeds maximum regex inspection limit`);
  }

  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(strInput);
  } catch (err) {
    throw new Error(`Invalid regular expression "${pattern}": ${err.message}`);
  }
}

/**
 * Normalizes operator names to canonical tokens
 */
function normalizeOperator(op = '') {
  const raw = String(op).toLowerCase().trim().replace(/[-_\s]+/g, '_');
  switch (raw) {
    case 'equals':
    case 'eq':
    case '==':
    case '===':
      return 'equals';

    case 'not_equals':
    case 'neq':
    case '!=':
    case '!==':
      return 'not_equals';

    case 'greater_than':
    case 'gt':
    case '>':
      return 'greater_than';

    case 'less_than':
    case 'lt':
    case '<':
      return 'less_than';

    case 'greater_or_equal':
    case 'greater_than_or_equal':
    case 'gte':
    case '>=':
      return 'greater_or_equal';

    case 'less_or_equal':
    case 'less_than_or_equal':
    case 'lte':
    case '<=':
      return 'less_or_equal';

    case 'contains':
    case 'includes':
    case 'has':
      return 'contains';

    case 'not_contains':
    case 'does_not_contain':
      return 'not_contains';

    case 'starts_with':
    case 'startswith':
    case 'prefix':
      return 'starts_with';

    case 'ends_with':
    case 'endswith':
    case 'suffix':
      return 'ends_with';

    case 'is_empty':
    case 'empty':
      return 'is_empty';

    case 'is_not_empty':
    case 'not_empty':
      return 'is_not_empty';

    case 'exists':
    case 'is_defined':
      return 'exists';

    case 'does_not_exist':
    case 'not_exists':
    case 'is_null':
      return 'does_not_exist';

    case 'is_true':
    case 'true':
      return 'is_true';

    case 'is_false':
    case 'false':
      return 'is_false';

    case 'matches_regex':
    case 'regex':
    case 'match':
      return 'matches_regex';

    case 'does_not_match_regex':
    case 'not_regex':
      return 'does_not_match_regex';

    default:
      return raw;
  }
}

/**
 * Evaluates a single comparison between left and right values
 * @param {any} left
 * @param {string} operator
 * @param {any} right
 * @returns {boolean}
 */
function compareValues(left, operator, right) {
  const normOp = normalizeOperator(operator);

  switch (normOp) {
    case 'equals':
      return deepEquals(left, right);

    case 'not_equals':
      return !deepEquals(left, right);

    case 'greater_than': {
      const numL = Number(left);
      const numR = Number(right);
      if (!isNaN(numL) && !isNaN(numR) && left !== '' && right !== '' && left !== null && right !== null) {
        return numL > numR;
      }
      return String(left ?? '') > String(right ?? '');
    }

    case 'less_than': {
      const numL = Number(left);
      const numR = Number(right);
      if (!isNaN(numL) && !isNaN(numR) && left !== '' && right !== '' && left !== null && right !== null) {
        return numL < numR;
      }
      return String(left ?? '') < String(right ?? '');
    }

    case 'greater_or_equal': {
      const numL = Number(left);
      const numR = Number(right);
      if (!isNaN(numL) && !isNaN(numR) && left !== '' && right !== '' && left !== null && right !== null) {
        return numL >= numR;
      }
      return String(left ?? '') >= String(right ?? '');
    }

    case 'less_or_equal': {
      const numL = Number(left);
      const numR = Number(right);
      if (!isNaN(numL) && !isNaN(numR) && left !== '' && right !== '' && left !== null && right !== null) {
        return numL <= numR;
      }
      return String(left ?? '') <= String(right ?? '');
    }

    case 'contains': {
      if (Array.isArray(left)) {
        return left.some((item) => deepEquals(item, right));
      }
      if (typeof left === 'object' && left !== null) {
        return Object.prototype.hasOwnProperty.call(left, String(right));
      }
      return String(left ?? '').includes(String(right ?? ''));
    }

    case 'not_contains': {
      if (Array.isArray(left)) {
        return !left.some((item) => deepEquals(item, right));
      }
      if (typeof left === 'object' && left !== null) {
        return !Object.prototype.hasOwnProperty.call(left, String(right));
      }
      return !String(left ?? '').includes(String(right ?? ''));
    }

    case 'starts_with':
      return String(left ?? '').startsWith(String(right ?? ''));

    case 'ends_with':
      return String(left ?? '').endsWith(String(right ?? ''));

    case 'is_empty':
      return isEmpty(left);

    case 'is_not_empty':
      return !isEmpty(left);

    case 'exists':
      return left !== null && left !== undefined;

    case 'does_not_exist':
      return left === null || left === undefined;

    case 'is_true':
      return isTruthy(left);

    case 'is_false':
      return !isTruthy(left);

    case 'matches_regex':
      return safeRegexMatch(left, right);

    case 'does_not_match_regex':
      return !safeRegexMatch(left, right);

    default:
      throw new Error(`Unsupported comparison operator "${operator}"`);
  }
}

/**
 * Resolves an expression or variable value from the execution context
 */
function resolveValue(val, context) {
  if (val === undefined || val === null) return val;

  if (typeof val === 'string') {
    // Check if whole string is an exact expression like "{{ steps.api.data }}"
    if (val.trim().startsWith('{{') && val.trim().endsWith('}}')) {
      const raw = resolveRawValue(val, context);
      if (raw !== undefined && raw !== null && raw !== '') {
        return raw;
      }
    }

    // Resolves embedded mustache variables in string
    if (val.includes('{{')) {
      const resolved = resolveVariable(val, context);
      // Fallback {{prev.fieldName}} references
      const prev = context?.lastOutput;
      if (prev && resolved.startsWith('{{')) {
        const path = resolved.replace(/[{}]/g, '').replace('prev.', '').trim();
        return path.split('.').reduce((o, k) => o?.[k], prev) ?? resolved;
      }
      return resolved;
    }
  }

  return val;
}

/**
 * Evaluates a single condition rule
 * @param {object} rule - { leftValue, operator, rightValue }
 * @param {object} context - ExecutionContext
 * @returns {object} Evaluation detail
 */
function evaluateRule(rule, context) {
  const operator = rule.operator || 'equals';
  const rawLeft = rule.leftValue !== undefined ? rule.leftValue : (rule.field !== undefined ? rule.field : '');
  const rawRight = rule.rightValue !== undefined ? rule.rightValue : (rule.value !== undefined ? rule.value : '');

  const left = resolveValue(rawLeft, context);
  const right = resolveValue(rawRight, context);

  let passed = false;
  let error = null;

  try {
    passed = compareValues(left, operator, right);
  } catch (err) {
    passed = false;
    error = err.message;
  }

  return {
    type: 'rule',
    passed,
    operator,
    normalizedOperator: normalizeOperator(operator),
    leftValue: left,
    rightValue: right,
    error,
    description: `${JSON.stringify(left)} ${operator} ${JSON.stringify(right)} => ${passed ? 'TRUE' : 'FALSE'}`,
  };
}

/**
 * Recursively evaluates a condition group or nested groups with AND / OR combinator
 * @param {object} group - { combinator: 'and' | 'or', conditions: Array<rule|group> }
 * @param {object} context - ExecutionContext
 * @returns {object} Evaluation detail
 */
function evaluateGroup(group, context) {
  const combinator = String(group.combinator || group.logicalOperator || 'and').toLowerCase().trim();
  const isOr = combinator === 'or';
  const subConditions = Array.isArray(group.conditions) ? group.conditions : [];

  if (subConditions.length === 0) {
    // Empty condition group defaults to TRUE
    return {
      type: 'group',
      combinator,
      passed: true,
      details: [],
    };
  }

  const details = [];
  let overallPassed = !isOr; // true for AND (needs all pass), false for OR (needs at least one pass)

  for (const item of subConditions) {
    let evalResult;

    if (item && Array.isArray(item.conditions)) {
      // Nested group
      evalResult = evaluateGroup(item, context);
    } else if (item && typeof item === 'object') {
      // Single condition rule
      evalResult = evaluateRule(item, context);
    } else {
      continue;
    }

    details.push(evalResult);

    if (isOr) {
      if (evalResult.passed) {
        overallPassed = true;
      }
    } else {
      if (!evalResult.passed) {
        overallPassed = false;
      }
    }
  }

  return {
    type: 'group',
    combinator,
    passed: overallPassed,
    details,
  };
}

/**
 * Top-level evaluation function for ConditionNode data
 * Backward-compatible with flat { leftValue, operator, rightValue }
 * and advanced nested { combinator, conditions: [...] }
 *
 * @param {object} data - Node data
 * @param {object} context - ExecutionContext
 * @returns {object} { passed, reason, evaluation }
 */
function evaluateCondition(data, context) {
  const nodeData = data || {};

  // Advanced mode: structured conditions array
  if (Array.isArray(nodeData.conditions) && nodeData.conditions.length > 0) {
    const groupResult = evaluateGroup(
      {
        combinator: nodeData.combinator || 'and',
        conditions: nodeData.conditions,
      },
      context
    );

    const passed = Boolean(groupResult.passed);
    const reason = `Condition group (${groupResult.combinator.toUpperCase()}) evaluated to ${passed ? 'TRUE' : 'FALSE'}`;

    return {
      passed,
      reason,
      evaluation: groupResult,
    };
  }

  // Legacy single condition fallback
  const singleRule = evaluateRule(
    {
      leftValue: nodeData.leftValue,
      operator: nodeData.operator || 'equals',
      rightValue: nodeData.rightValue,
    },
    context
  );

  const passed = Boolean(singleRule.passed);
  const reason = `Condition evaluated to ${passed ? 'TRUE' : 'FALSE'} (${singleRule.description})`;

  return {
    passed,
    reason,
    evaluation: {
      leftValue: singleRule.leftValue,
      operator: singleRule.operator,
      rightValue: singleRule.rightValue,
      details: [singleRule],
    },
  };
}

module.exports = {
  ConditionEvaluator: {
    compareValues,
    evaluateRule,
    evaluateGroup,
    evaluateCondition,
    normalizeOperator,
    deepEquals,
    isEmpty,
    isTruthy,
    safeRegexMatch,
  },
  compareValues,
  evaluateRule,
  evaluateGroup,
  evaluateCondition,
  normalizeOperator,
  deepEquals,
  safeRegexMatch,
};


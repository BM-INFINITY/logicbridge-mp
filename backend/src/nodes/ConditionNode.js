const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { evaluateCondition, normalizeOperator } = require('../utils/ConditionEvaluator');

const VALID_OPERATORS = [
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal',
  'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty',
  'exists', 'does_not_exist', 'is_true', 'is_false', 'matches_regex', 'does_not_match_regex',
];

class ConditionNode extends BaseNode {
  constructor(nodeType = NodeTypes.LOGIC_CONDITION) {
    super({
      type: nodeType,
      name: 'If / Condition',
      category: 'logic',
      icon: 'GitBranch',
      description: 'Evaluates advanced conditional logic with AND/OR groups, type-aware comparisons, and regex',
      version: '2.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};

    if (Array.isArray(data.conditions) && data.conditions.length > 0) {
      const combinator = String(data.combinator || 'and').toLowerCase();
      if (!['and', 'or'].includes(combinator)) {
        return { valid: false, error: 'Condition combinator must be "and" or "or"' };
      }
      return { valid: true };
    }

    if (data.operator) {
      const norm = normalizeOperator(data.operator);
      if (!VALID_OPERATORS.includes(norm)) {
        return { valid: false, error: `Unsupported condition operator "${data.operator}"` };
      }
    }

    return { valid: true };
  }

  async execute(node, context) {
    const data = node?.data || {};
    const { passed, reason, evaluation } = evaluateCondition(data, context);

    const branch = passed ? BranchTypes.TRUE : BranchTypes.FALSE;

    return {
      passed,
      branch,
      selectedBranch: branch,
      reason,
      evaluation,
      timestamp: new Date().toISOString(),
      result: reason,
    };
  }
}

module.exports = ConditionNode;

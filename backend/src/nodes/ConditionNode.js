const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { resolveVariable } = require('../utils');

class ConditionNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.LOGIC_CONDITION,
      name: 'If / Condition',
      category: 'logic',
      icon: '🔀',
      description: 'Evaluates conditional logic expressions (equals, contains, numeric comparison)',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    let { leftValue = '', operator = 'equals', rightValue = '' } = node.data || {};
    const prev = context?.lastOutput;

    let left = String(leftValue).includes('{{') ? resolveVariable(String(leftValue), context) : String(leftValue);
    let right = String(rightValue).includes('{{') ? resolveVariable(String(rightValue), context) : String(rightValue);

    // Allow fallback {{prev.fieldName}} references
    if (prev && String(left).startsWith('{{')) {
      const path = left.replace('{{', '').replace('}}', '').replace('prev.', '').trim();
      left = String(path.split('.').reduce((o, k) => o?.[k], prev) ?? left);
    }

    let passed = false;
    switch (operator) {
      case 'equals':       passed = String(left) === String(right); break;
      case 'not-equals':   passed = String(left) !== String(right); break;
      case 'contains':     passed = String(left).includes(String(right)); break;
      case 'greater-than': passed = Number(left) > Number(right); break;
      case 'less-than':    passed = Number(left) < Number(right); break;
      default:             passed = Boolean(left);
    }

    const branch = passed ? BranchTypes.TRUE : BranchTypes.FALSE;
    const reason = `Condition evaluated to ${passed ? 'TRUE' : 'FALSE'} (${left} ${operator} ${right})`;

    return {
      passed,
      branch,
      selectedBranch: branch,
      reason,
      evaluation: {
        leftValue: left,
        operator,
        rightValue: right,
      },
      timestamp: new Date().toISOString(),
      result: reason,
    };
  }
}

module.exports = ConditionNode;

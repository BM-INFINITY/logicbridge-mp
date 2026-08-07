const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');

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
    const prev = context.lastOutput;

    // Allow {{prev.fieldName}} references
    if (prev && String(leftValue).startsWith('{{')) {
      const path = leftValue.replace('{{', '').replace('}}', '').replace('prev.', '').trim();
      leftValue = String(path.split('.').reduce((o, k) => o?.[k], prev) ?? leftValue);
    }

    let passed = false;
    switch (operator) {
      case 'equals':       passed = String(leftValue) === String(rightValue); break;
      case 'not-equals':   passed = String(leftValue) !== String(rightValue); break;
      case 'contains':     passed = String(leftValue).includes(String(rightValue)); break;
      case 'greater-than': passed = Number(leftValue) > Number(rightValue); break;
      case 'less-than':    passed = Number(leftValue) < Number(rightValue); break;
      default:             passed = Boolean(leftValue);
    }

    const branch = passed ? BranchTypes.TRUE : BranchTypes.FALSE;
    const reason = `Condition evaluated to ${passed ? 'TRUE' : 'FALSE'} (${leftValue} ${operator} ${rightValue})`;

    return {
      passed,
      branch,
      selectedBranch: branch,
      reason,
      evaluation: {
        leftValue,
        operator,
        rightValue,
      },
      timestamp: new Date().toISOString(),
      result: reason,
    };
  }
}

module.exports = ConditionNode;

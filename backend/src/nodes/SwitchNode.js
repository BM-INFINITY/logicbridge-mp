const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveRawValue, resolveVariable } = require('../utils/VariableResolver');
const { compareValues, evaluateGroup } = require('../utils/ConditionEvaluator');

/**
 * SwitchNode — Multi-path router node in LogicBridge.
 * Evaluates an input against multiple configured cases in first-match order,
 * selecting exactly one branch handle (or fallback to 'default').
 */
class SwitchNode extends BaseNode {
  constructor(nodeType = NodeTypes.ACTION_SWITCH) {
    super({
      type: nodeType,
      name: 'Switch / Router',
      category: 'logic',
      icon: 'GitFork',
      description: 'Routes execution across multiple named branches based on value matching or custom rules',
      version: '1.0.0',
    });
  }

  /**
   * Validates switch configuration
   * @param {object} node
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(node) {
    const data = node?.data || {};

    if (data.cases !== undefined && !Array.isArray(data.cases)) {
      return { valid: false, error: 'Switch cases must be an array' };
    }

    if (Array.isArray(data.cases) && data.cases.length > 0) {
      const ids = new Set();
      for (const [idx, c] of data.cases.entries()) {
        const caseId = c.id || `case_${idx + 1}`;
        if (caseId === 'default') {
          return { valid: false, error: 'Case ID cannot be "default" (reserved for fallback branch)' };
        }
        if (ids.has(caseId)) {
          return { valid: false, error: `Duplicate case ID "${caseId}" in switch node` };
        }
        ids.add(caseId);
      }
    }

    return { valid: true };
  }

  /**
   * Executes the switch node
   * @param {object} node
   * @param {object} context - ExecutionContext
   * @returns {Promise<object>} Output payload
   */
  async execute(node, context) {
    const startedAt = Date.now();
    const data = node?.data || {};
    const defaultHandle = data.defaultHandle || 'default';

    // 1. Resolve shared input value
    let resolvedInput = undefined;
    if (data.input !== undefined && data.input !== null) {
      if (typeof data.input === 'string' && data.input.trim().startsWith('{{') && data.input.trim().endsWith('}}')) {
        resolvedInput = resolveRawValue(data.input, context);
      } else if (typeof data.input === 'string' && data.input.includes('{{')) {
        resolvedInput = resolveVariable(data.input, context);
      } else {
        resolvedInput = data.input;
      }
    } else if (context?.lastOutput !== undefined && context?.lastOutput !== null) {
      resolvedInput = context.lastOutput;
    }

    const cases = Array.isArray(data.cases) ? data.cases : [];
    let matchedCase = null;
    let matchedIndex = -1;
    let selectedBranch = defaultHandle;
    const evaluatedCases = [];

    // 2. Sequential first-match evaluation
    for (let i = 0; i < cases.length; i++) {
      const caseItem = cases[i];
      const caseId = caseItem.id || `case_${i + 1}`;
      const caseLabel = caseItem.label || `Case ${i + 1}`;
      const operator = caseItem.operator || 'equals';

      let isMatch = false;
      let error = null;

      try {
        if (Array.isArray(caseItem.conditions) && caseItem.conditions.length > 0) {
          // Rule/condition-group mode for this case
          const groupResult = evaluateGroup(
            {
              combinator: caseItem.combinator || 'and',
              conditions: caseItem.conditions,
            },
            context
          );
          isMatch = Boolean(groupResult.passed);
        } else {
          // Value / operator mode: compare resolvedInput with case value
          let targetValue = caseItem.value;
          if (typeof targetValue === 'string' && targetValue.includes('{{')) {
            targetValue = resolveRawValue(targetValue, context);
            if (targetValue === undefined || targetValue === '') {
              targetValue = resolveVariable(caseItem.value, context);
            }
          }

          // Case left value override if specified
          let leftVal = resolvedInput;
          if (caseItem.leftValue !== undefined && caseItem.leftValue !== '') {
            leftVal = typeof caseItem.leftValue === 'string' && caseItem.leftValue.includes('{{')
              ? resolveRawValue(caseItem.leftValue, context)
              : caseItem.leftValue;
          }

          isMatch = compareValues(leftVal, operator, targetValue);
        }
      } catch (err) {
        error = err.message;
        isMatch = false;
      }

      evaluatedCases.push({
        id: caseId,
        label: caseLabel,
        matched: isMatch,
        operator,
        error,
      });

      if (isMatch && matchedCase === null) {
        matchedCase = { id: caseId, label: caseLabel, index: i };
        matchedIndex = i;
        selectedBranch = caseId;
        break; // First-match strategy: stop at first winning branch!
      }
    }

    const matched = matchedCase !== null;
    const reason = matched
      ? `Switch matched case "${matchedCase.label}" (${matchedCase.id}) at index ${matchedIndex}`
      : `No switch case matched; routing to default branch (${defaultHandle})`;

    return {
      ok: true,
      matched,
      selectedBranch,
      branch: selectedBranch,
      matchedCaseId: matchedCase ? matchedCase.id : null,
      matchedCaseLabel: matchedCase ? matchedCase.label : null,
      matchedIndex,
      input: resolvedInput,
      reason,
      totalCases: cases.length,
      evaluatedCases,
      duration: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = SwitchNode;


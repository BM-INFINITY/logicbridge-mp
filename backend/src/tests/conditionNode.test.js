/**
 * ConditionNode & ConditionEvaluator Unit Tests
 */

const ConditionNode = require('../nodes/ConditionNode');
const { ConditionEvaluator, compareValues, evaluateCondition } = require('../utils/ConditionEvaluator');
const ExecutionContext = require('../utils/ExecutionContext');
const { NodeTypes, BranchTypes } = require('../constants');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runConditionTests() {
  console.log('\n🧪 Starting ConditionNode & ConditionEvaluator Unit Tests...\n');

  const conditionNode = new ConditionNode();

  // ── Group 1: Backward Compatibility (Flat Left/Operator/Right) ───────────
  console.log('Group 1: Backward Compatibility (Flat Left/Operator/Right)');
  try {
    const context = new ExecutionContext();
    context.setResult('prevNode', { status: 'active', count: 42 });

    const trueNode = {
      id: 'cond_legacy_true',
      data: {
        leftValue: '{{prev.status}}',
        operator: 'equals',
        rightValue: 'active',
      },
    };
    const resTrue = await conditionNode.execute(trueNode, context);
    assert(resTrue.passed === true, 'Legacy equals returns passed: true');
    assert(resTrue.branch === BranchTypes.TRUE, 'Legacy equals branch is TRUE');
    assert(resTrue.selectedBranch === BranchTypes.TRUE, 'Legacy selectedBranch is TRUE');
    assert(resTrue.evaluation !== undefined, 'Includes evaluation metadata');

    const falseNode = {
      id: 'cond_legacy_false',
      data: {
        leftValue: '{{prev.status}}',
        operator: 'equals',
        rightValue: 'inactive',
      },
    };
    const resFalse = await conditionNode.execute(falseNode, context);
    assert(resFalse.passed === false, 'Legacy equals returns passed: false');
    assert(resFalse.branch === BranchTypes.FALSE, 'Legacy equals branch is FALSE');
    assert(resFalse.selectedBranch === BranchTypes.FALSE, 'Legacy selectedBranch is FALSE');

    // Operator alias checks
    assert(compareValues('hello', 'contains', 'ell'), 'contains operator works');
    assert(compareValues(100, 'greater_than', 50), 'greater_than operator works');
    assert(compareValues(25, 'less_than', 50), 'less_than operator works');
    assert(compareValues('abc', 'not-equals', 'xyz'), 'not-equals kebab operator works');
  } catch (err) {
    console.error('Unexpected error in Group 1:', err);
    failedTests++;
  }

  // ── Group 2: All Comparison Operators & Type Coercion ────────────────────
  console.log('\nGroup 2: All Comparison Operators & Type Coercion');
  try {
    // Greater / Less than or equal
    assert(compareValues(50, 'greater_or_equal', 50), 'greater_or_equal with equal numbers');
    assert(compareValues(55, 'greater_or_equal', 50), 'greater_or_equal with greater number');
    assert(!compareValues(45, 'greater_or_equal', 50), 'greater_or_equal rejects smaller number');
    assert(compareValues(30, 'less_or_equal', 30), 'less_or_equal with equal numbers');
    assert(compareValues(20, 'less_or_equal', 30), 'less_or_equal with smaller number');

    // String prefix / suffix
    assert(compareValues('order_12345', 'starts_with', 'order_'), 'starts_with prefix match');
    assert(!compareValues('order_12345', 'starts_with', 'user_'), 'starts_with prefix mismatch');
    assert(compareValues('report.pdf', 'ends_with', '.pdf'), 'ends_with suffix match');
    assert(!compareValues('report.pdf', 'ends_with', '.csv'), 'ends_with suffix mismatch');

    // Collection contains
    assert(compareValues(['apple', 'banana', 'cherry'], 'contains', 'banana'), 'Array contains item');
    assert(compareValues(['apple', 'banana', 'cherry'], 'not_contains', 'grape'), 'Array not_contains item');
    assert(compareValues({ id: 1, role: 'admin' }, 'contains', 'role'), 'Object contains property key');

    // Emptiness & Existence
    assert(compareValues('', 'is_empty', null), 'Empty string is empty');
    assert(compareValues([], 'is_empty', null), 'Empty array is empty');
    assert(compareValues({}, 'is_empty', null), 'Empty object is empty');
    assert(compareValues(null, 'is_empty', null), 'null is empty');
    assert(compareValues('data', 'is_not_empty', null), 'Populated string is not empty');
    assert(compareValues([1, 2], 'is_not_empty', null), 'Populated array is not empty');

    assert(compareValues('hello', 'exists', null), 'String exists');
    assert(compareValues(0, 'exists', null), 'Number 0 exists');
    assert(!compareValues(null, 'exists', null), 'null does not exist');
    assert(!compareValues(undefined, 'exists', null), 'undefined does not exist');
    assert(compareValues(null, 'does_not_exist', null), 'null matches does_not_exist');

    // Booleans
    assert(compareValues(true, 'is_true', null), 'boolean true is_true');
    assert(compareValues('true', 'is_true', null), 'string "true" is_true');
    assert(compareValues(1, 'is_true', null), 'number 1 is_true');
    assert(compareValues(false, 'is_false', null), 'boolean false is_false');
    assert(compareValues('false', 'is_false', null), 'string "false" is_false');

    // Deep equality
    assert(compareValues({ a: 1, b: [2, 3] }, 'equals', { a: 1, b: [2, 3] }), 'Deep object equality');
    assert(compareValues([1, 2, { c: 3 }], 'equals', [1, 2, { c: 3 }]), 'Deep array equality');
  } catch (err) {
    console.error('Unexpected error in Group 2:', err);
    failedTests++;
  }

  // ── Group 3: Safe Regular Expressions & ReDoS Protection ─────────────────
  console.log('\nGroup 3: Safe Regular Expressions & ReDoS Protection');
  try {
    assert(compareValues('usr_test_123@example.com', 'matches_regex', '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$'), 'Safe email regex match');
    assert(!compareValues('invalid_email', 'matches_regex', '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$'), 'Safe email regex mismatch');
    assert(compareValues('PROD-2026-XYZ', 'does_not_match_regex', '^DEV-'), 'does_not_match_regex works');

    // Catastrophic backtracking patterns rejection
    let redosThrew = false;
    try {
      compareValues('aaaaaaaaaaaaaaaaaaaaaaaaa!', 'matches_regex', '(a+)+$');
    } catch (e) {
      redosThrew = e.message.includes('catastrophic backtracking');
    }
    assert(redosThrew, 'Rejects nested quantifier (a+)+ ReDoS attempt');

    redosThrew = false;
    try {
      compareValues('aaaaaaaaaaaaaaaaaaaaaaaaa!', 'matches_regex', '(a*)*');
    } catch (e) {
      redosThrew = e.message.includes('catastrophic backtracking');
    }
    assert(redosThrew, 'Rejects nested quantifier (a*)* ReDoS attempt');

    // Pattern length limit
    let longPatternThrew = false;
    try {
      const longPat = 'a'.repeat(400);
      compareValues('text', 'matches_regex', longPat);
    } catch (e) {
      longPatternThrew = e.message.includes('exceeds maximum length');
    }
    assert(longPatternThrew, 'Rejects pattern longer than 300 characters');
  } catch (err) {
    console.error('Unexpected error in Group 3:', err);
    failedTests++;
  }

  // ── Group 4: AND / OR Logical Groups ─────────────────────────────────────
  console.log('\nGroup 4: AND / OR Logical Groups');
  try {
    const context = new ExecutionContext();
    context.setResult('api', {
      user: { role: 'admin', age: 30, verified: true, tags: ['staff', 'vip'] },
      cart: { total: 150, currency: 'USD' },
    });

    // AND group: all conditions true
    const andGroupTrue = {
      combinator: 'and',
      conditions: [
        { leftValue: '{{steps.api.user.role}}', operator: 'equals', rightValue: 'admin' },
        { leftValue: '{{steps.api.cart.total}}', operator: 'greater_than', rightValue: '100' },
        { leftValue: '{{steps.api.user.verified}}', operator: 'is_true' },
      ],
    };
    const resAndTrue = evaluateCondition(andGroupTrue, context);
    assert(resAndTrue.passed === true, 'AND group with all true conditions passes');

    // AND group: one condition false
    const andGroupFalse = {
      combinator: 'and',
      conditions: [
        { leftValue: '{{steps.api.user.role}}', operator: 'equals', rightValue: 'admin' },
        { leftValue: '{{steps.api.cart.total}}', operator: 'greater_than', rightValue: '500' }, // false
      ],
    };
    const resAndFalse = evaluateCondition(andGroupFalse, context);
    assert(resAndFalse.passed === false, 'AND group with one false condition fails');

    // OR group: one condition true
    const orGroupTrue = {
      combinator: 'or',
      conditions: [
        { leftValue: '{{steps.api.cart.total}}', operator: 'greater_than', rightValue: '1000' }, // false
        { leftValue: '{{steps.api.user.role}}', operator: 'equals', rightValue: 'admin' }, // true
      ],
    };
    const resOrTrue = evaluateCondition(orGroupTrue, context);
    assert(resOrTrue.passed === true, 'OR group with one true condition passes');

    // OR group: all conditions false
    const orGroupFalse = {
      combinator: 'or',
      conditions: [
        { leftValue: '{{steps.api.cart.total}}', operator: 'greater_than', rightValue: '1000' },
        { leftValue: '{{steps.api.user.role}}', operator: 'equals', rightValue: 'guest' },
      ],
    };
    const resOrFalse = evaluateCondition(orGroupFalse, context);
    assert(resOrFalse.passed === false, 'OR group with all false conditions fails');
  } catch (err) {
    console.error('Unexpected error in Group 4:', err);
    failedTests++;
  }

  // ── Group 5: Nested Condition Groups ─────────────────────────────────────
  console.log('\nGroup 5: Nested Condition Groups');
  try {
    const context = new ExecutionContext();
    context.setResult('order', {
      customer: { tier: 'gold', country: 'US', fraudScore: 0.05 },
      amount: 250,
      paymentMethod: 'credit_card',
    });

    // Structure: (tier == 'gold' AND amount > 200) OR (country == 'US' AND fraudScore < 0.1 AND paymentMethod == 'paypal')
    const nestedConfig = {
      combinator: 'or',
      conditions: [
        {
          combinator: 'and',
          conditions: [
            { leftValue: '{{steps.order.customer.tier}}', operator: 'equals', rightValue: 'gold' },
            { leftValue: '{{steps.order.amount}}', operator: 'greater_than', rightValue: '200' },
          ],
        },
        {
          combinator: 'and',
          conditions: [
            { leftValue: '{{steps.order.customer.country}}', operator: 'equals', rightValue: 'US' },
            { leftValue: '{{steps.order.paymentMethod}}', operator: 'equals', rightValue: 'paypal' }, // false
          ],
        },
      ],
    };

    const resNested = evaluateCondition(nestedConfig, context);
    assert(resNested.passed === true, 'Nested condition group (Group 1 passed) evaluates to TRUE');
    assert(resNested.evaluation.details.length === 2, 'Top-level group has 2 nested details');
    assert(resNested.evaluation.details[0].passed === true, 'First nested group passed');
    assert(resNested.evaluation.details[1].passed === false, 'Second nested group failed');

    // Execution through ConditionNode
    const nodeRes = await conditionNode.execute({ id: 'cond_nested', data: nestedConfig }, context);
    assert(nodeRes.passed === true, 'ConditionNode execute with nested groups succeeds');
    assert(nodeRes.branch === BranchTypes.TRUE, 'ConditionNode selects TRUE branch');
    assert(nodeRes.selectedBranch === BranchTypes.TRUE, 'ConditionNode selectedBranch is TRUE');
  } catch (err) {
    console.error('Unexpected error in Group 5:', err);
    failedTests++;
  }

  // ── Group 6: Node Validation Rules ───────────────────────────────────────
  console.log('\nGroup 6: Node Validation Rules');
  try {
    assert(conditionNode.validate({ data: { operator: 'equals' } }).valid === true, 'Accepts valid operator equals');
    assert(conditionNode.validate({ data: { operator: 'is_not_empty' } }).valid === true, 'Accepts is_not_empty');
    assert(conditionNode.validate({ data: { operator: 'INVALID_OP' } }).valid === false, 'Rejects unsupported operator');
    assert(conditionNode.validate({ data: { combinator: 'and', conditions: [] } }).valid === true, 'Accepts valid combinator');
    assert(conditionNode.validate({ data: { combinator: 'xor', conditions: [{}] } }).valid === false, 'Rejects invalid combinator xor');
  } catch (err) {
    console.error('Unexpected error in Group 6:', err);
    failedTests++;
  }

  console.log(`\nConditionNode Tests: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runConditionTests();


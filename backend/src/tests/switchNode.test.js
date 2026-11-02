/**
 * SwitchNode Unit Tests
 */

const SwitchNode = require('../nodes/SwitchNode');
const ExecutionContext = require('../utils/ExecutionContext');
const { NodeTypes } = require('../constants');
const { registry } = require('../nodes');

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

async function runSwitchTests() {
  console.log('\n🧪 Starting SwitchNode Unit Tests...\n');

  const switchNode = new SwitchNode();

  // ── Group 1: Registry & Metadata ──────────────────────────────────────────
  console.log('Group 1: Registry & Metadata');
  try {
    assert(switchNode.type === NodeTypes.ACTION_SWITCH, 'Default type is action-switch');
    assert(switchNode.name === 'Switch / Router', 'Node name is Switch / Router');
    assert(switchNode.category === 'logic', 'Node category is logic');
    assert(registry.has(NodeTypes.ACTION_SWITCH), 'Registry contains action-switch');
    assert(registry.has(NodeTypes.LOGIC_SWITCH), 'Registry contains logic-switch');
  } catch (err) {
    console.error('Unexpected error in Group 1:', err);
    failedTests++;
  }

  // ── Group 2: Validation Rules ─────────────────────────────────────────────
  console.log('\nGroup 2: Validation Rules');
  try {
    assert(switchNode.validate({ data: { cases: [] } }).valid === true, 'Valid empty cases');
    assert(
      switchNode.validate({
        data: {
          cases: [
            { id: 'case_vip', label: 'VIP' },
            { id: 'case_guest', label: 'Guest' },
          ],
        },
      }).valid === true,
      'Valid unique case IDs'
    );

    assert(
      switchNode.validate({
        data: {
          cases: [
            { id: 'dup_id', label: 'First' },
            { id: 'dup_id', label: 'Second' },
          ],
        },
      }).valid === false,
      'Rejects duplicate case IDs'
    );

    assert(
      switchNode.validate({
        data: {
          cases: [{ id: 'default', label: 'Default' }],
        },
      }).valid === false,
      'Rejects case ID named "default" (reserved for fallback)'
    );

    assert(
      switchNode.validate({
        data: { cases: 'not-an-array' },
      }).valid === false,
      'Rejects non-array cases'
    );
  } catch (err) {
    console.error('Unexpected error in Group 2:', err);
    failedTests++;
  }

  // ── Group 3: Exact Value Matching ─────────────────────────────────────────
  console.log('\nGroup 3: Exact Value Matching');
  try {
    const context = new ExecutionContext();
    context.setResult('auth', { role: 'editor', tier: 'silver' });

    const node = {
      id: 'sw_roles',
      data: {
        input: '{{steps.auth.role}}',
        cases: [
          { id: 'admin_route', label: 'Admin Route', value: 'admin' },
          { id: 'editor_route', label: 'Editor Route', value: 'editor' },
          { id: 'viewer_route', label: 'Viewer Route', value: 'viewer' },
        ],
      },
    };

    const result = await switchNode.execute(node, context);
    assert(result.ok === true, 'Execution ok');
    assert(result.matched === true, 'matched is true');
    assert(result.selectedBranch === 'editor_route', 'Selected branch is editor_route');
    assert(result.matchedCaseId === 'editor_route', 'matchedCaseId is editor_route');
    assert(result.matchedCaseLabel === 'Editor Route', 'matchedCaseLabel matches');
    assert(result.matchedIndex === 1, 'matchedIndex is 1');
    assert(result.input === 'editor', 'input resolved to editor');
  } catch (err) {
    console.error('Unexpected error in Group 3:', err);
    failedTests++;
  }

  // ── Group 4: Comparison-Based Matching & Data Types ───────────────────────
  console.log('\nGroup 4: Comparison-Based Matching & Data Types');
  try {
    const context = new ExecutionContext();
    context.setResult('order', { total: 450, customerEmail: 'ceo@enterprise.com' });

    // Numeric thresholds router
    const nodeNumeric = {
      id: 'sw_tiers',
      data: {
        input: '{{steps.order.total}}',
        cases: [
          { id: 'tier_diamond', label: 'Diamond Tier', operator: 'greater_or_equal', value: 1000 },
          { id: 'tier_gold', label: 'Gold Tier', operator: 'greater_or_equal', value: 400 },
          { id: 'tier_silver', label: 'Silver Tier', operator: 'greater_or_equal', value: 100 },
        ],
      },
    };

    const resNumeric = await switchNode.execute(nodeNumeric, context);
    assert(resNumeric.matched === true, 'Numeric matched: true');
    assert(resNumeric.selectedBranch === 'tier_gold', '450 matched tier_gold (>= 400)');
    assert(resNumeric.matchedIndex === 1, 'Matched index is 1');

    // String regex router
    const nodeRegex = {
      id: 'sw_email',
      data: {
        input: '{{steps.order.customerEmail}}',
        cases: [
          { id: 'enterprise_lead', label: 'Enterprise Lead', operator: 'ends_with', value: '@enterprise.com' },
          { id: 'public_lead', label: 'Public Lead', operator: 'matches_regex', value: '@(gmail|yahoo)\\.com$' },
        ],
      },
    };

    const resRegex = await switchNode.execute(nodeRegex, context);
    assert(resRegex.matched === true, 'Regex switch matched: true');
    assert(resRegex.selectedBranch === 'enterprise_lead', 'Matched enterprise_lead');
  } catch (err) {
    console.error('Unexpected error in Group 4:', err);
    failedTests++;
  }

  // ── Group 5: First-Match Strategy with Multiple Matches ───────────────────
  console.log('\nGroup 5: Explicit First-Match Behavior');
  try {
    const context = new ExecutionContext();
    context.setResult('item', { score: 95 });

    // Both case_1 and case_2 match score >= 90 and score >= 80, first-match MUST choose case_1
    const nodeMulti = {
      id: 'sw_multi_match',
      data: {
        input: '{{steps.item.score}}',
        cases: [
          { id: 'grade_a', label: 'Grade A', operator: 'greater_or_equal', value: 90 },
          { id: 'grade_b', label: 'Grade B', operator: 'greater_or_equal', value: 80 },
          { id: 'grade_c', label: 'Grade C', operator: 'greater_or_equal', value: 70 },
        ],
      },
    };

    const resMulti = await switchNode.execute(nodeMulti, context);
    assert(resMulti.matched === true, 'Matched: true');
    assert(resMulti.selectedBranch === 'grade_a', 'Selected first matching branch (grade_a)');
    assert(resMulti.matchedIndex === 0, 'Matched index is 0');
    assert(resMulti.evaluatedCases.length === 1, 'Evaluation stopped after first match (short-circuit)');
  } catch (err) {
    console.error('Unexpected error in Group 5:', err);
    failedTests++;
  }

  // ── Group 6: Fallback to Default Branch ───────────────────────────────────
  console.log('\nGroup 6: Fallback to Default Branch');
  try {
    const context = new ExecutionContext();
    context.setResult('input', { country: 'JP' });

    const nodeNoMatch = {
      id: 'sw_default_fallback',
      data: {
        input: '{{steps.input.country}}',
        cases: [
          { id: 'us_route', label: 'US Route', value: 'US' },
          { id: 'uk_route', label: 'UK Route', value: 'UK' },
          { id: 'ca_route', label: 'Canada Route', value: 'CA' },
        ],
        defaultHandle: 'default',
      },
    };

    const resNoMatch = await switchNode.execute(nodeNoMatch, context);
    assert(resNoMatch.matched === false, 'matched is false');
    assert(resNoMatch.selectedBranch === 'default', 'selectedBranch is default');
    assert(resNoMatch.matchedCaseId === null, 'matchedCaseId is null');
    assert(resNoMatch.matchedIndex === -1, 'matchedIndex is -1');
    assert(resNoMatch.evaluatedCases.length === 3, 'Evaluated all 3 cases before defaulting');
  } catch (err) {
    console.error('Unexpected error in Group 6:', err);
    failedTests++;
  }

  // ── Group 7: Condition Group / Rule Mode Within Switch Cases ──────────────
  console.log('\nGroup 7: Condition Groups Within Switch Cases');
  try {
    const context = new ExecutionContext();
    context.setResult('ticket', { priority: 'P1', vip: true, department: 'security' });

    const nodeRules = {
      id: 'sw_complex_rules',
      data: {
        cases: [
          {
            id: 'emergency_escalation',
            label: 'Emergency Escalation',
            combinator: 'and',
            conditions: [
              { leftValue: '{{steps.ticket.priority}}', operator: 'equals', rightValue: 'P1' },
              { leftValue: '{{steps.ticket.vip}}', operator: 'is_true' },
            ],
          },
          {
            id: 'standard_it',
            label: 'Standard IT',
            combinator: 'and',
            conditions: [
              { leftValue: '{{steps.ticket.department}}', operator: 'equals', rightValue: 'it' },
            ],
          },
        ],
      },
    };

    const resRules = await switchNode.execute(nodeRules, context);
    assert(resRules.matched === true, 'Rule-based case matched: true');
    assert(resRules.selectedBranch === 'emergency_escalation', 'Selected emergency_escalation branch');
  } catch (err) {
    console.error('Unexpected error in Group 7:', err);
    failedTests++;
  }

  console.log(`\nSwitchNode Tests: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runSwitchTests();


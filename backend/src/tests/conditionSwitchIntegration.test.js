/**
 * Condition & Switch Multi-Path Routing Integration Tests
 */

const { run, buildExecutionOrder } = require('../services/workflowEngine');
const { NodeTypes, BranchTypes, ExecutionStatus, ExecutionEvents } = require('../constants');
const BranchTraversal = require('../services/BranchTraversal');
const ExecutionContext = require('../utils/ExecutionContext');

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

// Mock workflow runner helper with in-memory execution capture
async function executeMockWorkflow(workflowDef, triggerPayload = null) {
  const steps = [];
  const executionPath = {
    visitedNodes: [],
    skippedNodes: new Set(),
    branches: {},
    events: [],
    recordVisited: function (id) { this.visitedNodes.push(id); },
    recordSkipped: function (id) { this.skippedNodes.add(id); },
    recordBranch: function (id, b) { this.branches[id] = b; },
    emitEvent: function (type, payload) { this.events.push({ type, payload }); },
  };

  const orderedNodes = buildExecutionOrder(workflowDef.nodes, workflowDef.edges);
  const context = new ExecutionContext({
    workflowId: workflowDef._id || 'wf_test',
    ownerId: 'usr_test_routing',
    trigger: 'manual',
  });
  context.triggerPayload = triggerPayload;

  const executedOutputs = {};

  for (const node of orderedNodes) {
    const canExecute = BranchTraversal.isNodeExecutable(
      node,
      workflowDef.nodes,
      workflowDef.edges,
      executedOutputs,
      executionPath.skippedNodes,
      context
    );

    if (!canExecute) {
      executionPath.recordSkipped(node.id);
      steps.push({
        nodeId: node.id,
        nodeName: node.data?.label || node.type,
        nodeType: node.type,
        status: ExecutionStatus.SKIPPED,
        output: { skippedReason: 'Branch not selected' },
      });
      continue;
    }

    const { registry } = require('../nodes');
    const handler = registry.get(node.type);
    if (!handler) continue;

    const output = await handler.execute(node, context);
    executedOutputs[node.id] = output;
    context.setResult(node.id, output);

    if (
      (node.type === NodeTypes.LOGIC_CONDITION || node.type === NodeTypes.ACTION_CONDITION) &&
      output?.selectedBranch
    ) {
      executionPath.recordBranch(node.id, output.selectedBranch);
      executionPath.emitEvent(ExecutionEvents.CONDITION_EVALUATED, { nodeId: node.id, passed: output.passed });
      executionPath.emitEvent(ExecutionEvents.BRANCH_SELECTED, { nodeId: node.id, selectedBranch: output.selectedBranch });
    }

    if (
      (node.type === NodeTypes.ACTION_SWITCH || node.type === NodeTypes.LOGIC_SWITCH) &&
      output?.selectedBranch
    ) {
      executionPath.recordBranch(node.id, output.selectedBranch);
      executionPath.emitEvent(ExecutionEvents.SWITCH_EVALUATED, {
        nodeId: node.id,
        selectedBranch: output.selectedBranch,
        matchedCaseLabel: output.matchedCaseLabel,
      });
      executionPath.emitEvent(ExecutionEvents.BRANCH_SELECTED, { nodeId: node.id, selectedBranch: output.selectedBranch });
    }

    steps.push({
      nodeId: node.id,
      nodeName: node.data?.label || node.type,
      nodeType: node.type,
      status: ExecutionStatus.SUCCESS,
      output,
    });
  }

  return { steps, executionPath, context, executedOutputs };
}

async function runRoutingIntegrationTests() {
  console.log('\n🧪 Starting Advanced Condition & Switch Integration Tests...\n');

  // ── Pipeline 1: Switch 3-Way Routing with Default Fallback ────────────────
  console.log('Pipeline 1: Switch 3-Way Routing with Default Fallback');
  try {
    const workflow = {
      _id: 'wf_switch_routing',
      nodes: [
        { id: 'start', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } },
        {
          id: 'router',
          type: NodeTypes.ACTION_SWITCH,
          data: {
            label: 'Route Request',
            input: '{{trigger.tier}}',
            cases: [
              { id: 'case_vip', label: 'VIP Route', value: 'vip' },
              { id: 'case_partner', label: 'Partner Route', value: 'partner' },
            ],
            defaultHandle: 'default',
          },
        },
        { id: 'vip_action', type: NodeTypes.ACTION_LOG, data: { label: 'VIP Log', message: 'Welcome VIP' } },
        { id: 'partner_action', type: NodeTypes.ACTION_LOG, data: { label: 'Partner Log', message: 'Welcome Partner' } },
        { id: 'default_action', type: NodeTypes.ACTION_LOG, data: { label: 'Standard Log', message: 'Welcome Standard' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'router' },
        { id: 'e_vip', source: 'router', target: 'vip_action', sourceHandle: 'case_vip' },
        { id: 'e_partner', source: 'router', target: 'partner_action', sourceHandle: 'case_partner' },
        { id: 'e_def', source: 'router', target: 'default_action', sourceHandle: 'default' },
      ],
    };

    // Test Run A: tier = 'vip'
    const resVip = await executeMockWorkflow(workflow, { tier: 'vip' });
    const stepVipLog = resVip.steps.find((s) => s.nodeId === 'vip_action');
    const stepPartnerLog = resVip.steps.find((s) => s.nodeId === 'partner_action');
    const stepDefLog = resVip.steps.find((s) => s.nodeId === 'default_action');

    assert(stepVipLog?.status === ExecutionStatus.SUCCESS, 'VIP action executed successfully');
    assert(stepPartnerLog?.status === ExecutionStatus.SKIPPED, 'Partner action was skipped');
    assert(stepDefLog?.status === ExecutionStatus.SKIPPED, 'Default action was skipped');
    assert(resVip.executionPath.branches['router'] === 'case_vip', 'Selected branch recorded as case_vip');

    // Test Run B: tier = 'unknown' (fallback to default)
    const resDefault = await executeMockWorkflow(workflow, { tier: 'unknown' });
    const stepVipLogB = resDefault.steps.find((s) => s.nodeId === 'vip_action');
    const stepPartnerLogB = resDefault.steps.find((s) => s.nodeId === 'partner_action');
    const stepDefLogB = resDefault.steps.find((s) => s.nodeId === 'default_action');

    assert(stepDefLogB?.status === ExecutionStatus.SUCCESS, 'Default action executed when tier unknown');
    assert(stepVipLogB?.status === ExecutionStatus.SKIPPED, 'VIP action skipped on default route');
    assert(stepPartnerLogB?.status === ExecutionStatus.SKIPPED, 'Partner action skipped on default route');
    assert(resDefault.executionPath.branches['router'] === 'default', 'Selected branch recorded as default');
  } catch (err) {
    console.error('Unexpected error in Pipeline 1:', err);
    failedTests++;
  }

  // ── Pipeline 2: Nested Conditions + Switch Combined ───────────────────────
  console.log('\nPipeline 2: Nested Conditions + Switch Combined');
  try {
    const workflow = {
      _id: 'wf_nested_cond_switch',
      nodes: [
        { id: 'start', type: NodeTypes.TRIGGER_MANUAL, data: { label: 'Start' } },
        {
          id: 'cond_eligibility',
          type: NodeTypes.LOGIC_CONDITION,
          data: {
            label: 'Check Eligibility',
            combinator: 'and',
            conditions: [
              { leftValue: '{{trigger.active}}', operator: 'is_true' },
              { leftValue: '{{trigger.score}}', operator: 'greater_than', rightValue: 70 },
            ],
          },
        },
        {
          id: 'switch_category',
          type: NodeTypes.ACTION_SWITCH,
          data: {
            label: 'Route Category',
            input: '{{trigger.category}}',
            cases: [
              { id: 'case_tech', label: 'Tech Dept', value: 'tech' },
              { id: 'case_finance', label: 'Finance Dept', value: 'finance' },
            ],
            defaultHandle: 'default',
          },
        },
        { id: 'ineligible_log', type: NodeTypes.ACTION_LOG, data: { label: 'Ineligible Alert' } },
        { id: 'tech_log', type: NodeTypes.ACTION_LOG, data: { label: 'Tech Pipeline' } },
        { id: 'finance_log', type: NodeTypes.ACTION_LOG, data: { label: 'Finance Pipeline' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'cond_eligibility' },
        // Condition true branch leads to switch node
        { id: 'e_cond_true', source: 'cond_eligibility', target: 'switch_category', sourceHandle: BranchTypes.TRUE },
        // Condition false branch leads to alert
        { id: 'e_cond_false', source: 'cond_eligibility', target: 'ineligible_log', sourceHandle: BranchTypes.FALSE },
        // Switch branches
        { id: 'e_sw_tech', source: 'switch_category', target: 'tech_log', sourceHandle: 'case_tech' },
        { id: 'e_sw_fin', source: 'switch_category', target: 'finance_log', sourceHandle: 'case_finance' },
      ],
    };

    // Case A: Active = true, Score = 85, Category = 'tech'
    const resA = await executeMockWorkflow(workflow, { active: true, score: 85, category: 'tech' });
    assert(resA.steps.find((s) => s.nodeId === 'cond_eligibility')?.output.passed === true, 'Condition passed');
    assert(resA.steps.find((s) => s.nodeId === 'switch_category')?.status === ExecutionStatus.SUCCESS, 'Switch ran');
    assert(resA.steps.find((s) => s.nodeId === 'tech_log')?.status === ExecutionStatus.SUCCESS, 'Tech log executed');
    assert(resA.steps.find((s) => s.nodeId === 'finance_log')?.status === ExecutionStatus.SKIPPED, 'Finance log skipped');
    assert(resA.steps.find((s) => s.nodeId === 'ineligible_log')?.status === ExecutionStatus.SKIPPED, 'Ineligible log skipped');

    // Case B: Ineligible (Score = 50)
    const resB = await executeMockWorkflow(workflow, { active: true, score: 50, category: 'tech' });
    assert(resB.steps.find((s) => s.nodeId === 'cond_eligibility')?.output.passed === false, 'Condition failed');
    assert(resB.steps.find((s) => s.nodeId === 'switch_category')?.status === ExecutionStatus.SKIPPED, 'Switch was skipped');
    assert(resB.steps.find((s) => s.nodeId === 'tech_log')?.status === ExecutionStatus.SKIPPED, 'Downstream tech log skipped');
    assert(resB.steps.find((s) => s.nodeId === 'ineligible_log')?.status === ExecutionStatus.SUCCESS, 'Ineligible log ran on FALSE branch');
  } catch (err) {
    console.error('Unexpected error in Pipeline 2:', err);
    failedTests++;
  }

  // ── Pipeline 3: Loop + Switch Combination ────────────────────────────────
  console.log('\nPipeline 3: Loop + Switch Combination');
  try {
    const LoopNode = require('../nodes/LoopNode');
    const SwitchNode = require('../nodes/SwitchNode');

    const loopNode = new LoopNode();
    const switchNode = new SwitchNode();
    const context = new ExecutionContext();

    const users = [
      { name: 'Alice', plan: 'enterprise' },
      { name: 'Bob', plan: 'pro' },
      { name: 'Charlie', plan: 'free' },
    ];

    const routedUsers = [];

    const loopOutput = await loopNode.execute(
      {
        id: 'user_loop',
        data: {
          operation: 'loop_items',
          items: users,
        },
      },
      context,
      {
        executeBody: async (iterationState) => {
          const swOutput = await switchNode.execute(
            {
              id: 'plan_switch',
              data: {
                input: '{{loop.item.plan}}',
                cases: [
                  { id: 'branch_ent', label: 'Enterprise', value: 'enterprise' },
                  { id: 'branch_pro', label: 'Pro', value: 'pro' },
                ],
                defaultHandle: 'branch_free',
              },
            },
            context
          );
          routedUsers.push({
            user: iterationState.item.name,
            selectedBranch: swOutput.selectedBranch,
          });
          return swOutput;
        },
      }
    );

    assert(loopOutput.completed === true, 'Loop completed');
    assert(routedUsers.length === 3, 'All 3 users processed through switch');
    assert(routedUsers[0].selectedBranch === 'branch_ent', 'Alice routed to branch_ent');
    assert(routedUsers[1].selectedBranch === 'branch_pro', 'Bob routed to branch_pro');
    assert(routedUsers[2].selectedBranch === 'branch_free', 'Charlie routed to branch_free default');
  } catch (err) {
    console.error('Unexpected error in Pipeline 3:', err);
    failedTests++;
  }

  console.log(`\nCondition & Switch Integration Tests: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runRoutingIntegrationTests();

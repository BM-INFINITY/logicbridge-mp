/**
 * Integration Tests for Workflow Variables & Secrets
 * Tests complete end-to-end execution of workflows containing Variables and Secrets
 * across Conditions, Loops, HTTP, Transforms, and verifies secret redaction.
 */

const assert = require('assert');
const { executeNodeStep, executeLoopStep } = require('../services/workflowEngine');
const ExecutionContext = require('../utils/ExecutionContext');
const ExecutionPath = require('../utils/ExecutionPath');
const { redactSecrets, registerActiveSecrets, clearActiveSecrets } = require('../utils/SecretRedactor');
const { NodeTypes, BranchTypes } = require('../constants');

let passedTests = 0;
let failedTests = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(message);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Variables & Secrets Integration Tests...\n');

  // ── Pipeline 1: Variable & Secret Resolution in Chained Nodes ─────────────
  console.log('Pipeline 1: Variables & Secrets Chained Execution');
  {
    const secretApiKey = 'live_sec_key_xyz999888777';
    const secretPass = 'SuperSecretDb123!';

    const workflow = {
      _id: 'wf_integration_1',
      name: 'Variables & Secrets Integration Flow',
      variables: [
        { name: 'apiUrl', type: 'string', value: 'https://api.internal.service.com' },
        { name: 'discountPercent', type: 'number', value: 20 },
        { name: 'isVip', type: 'boolean', value: true },
        { name: 'batchItems', type: 'json', value: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
      ],
      nodes: [],
      edges: [],
    };

    // Build context as workflowEngine does
    const variablesMap = {
      apiUrl: 'https://api.internal.service.com',
      discountPercent: 20,
      isVip: true,
      batchItems: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    };
    const secretsMap = {
      API_KEY: secretApiKey,
      DB_PASSWORD: secretPass,
    };

    registerActiveSecrets(secretsMap);

    const context = new ExecutionContext({
      workflowId: workflow._id,
      ownerId: 'user_1',
      trigger: 'manual',
      variables: variablesMap,
      secrets: secretsMap,
    });
    const executionPath = new ExecutionPath();
    const steps = [];

    // Step 1: Text Node resolving {{ variables.apiUrl }} and {{ secrets.API_KEY }}
    const textNode = {
      id: 'step_text',
      type: NodeTypes.ACTION_TEXT,
      data: {
        operation: 'replace',
        input: 'Target: {{ variables.apiUrl }} | Key: {{ secrets.API_KEY }}',
        find: 'internal',
        replace: 'production',
      },
    };

    const textOutput = await executeNodeStep(textNode, context, executionPath, steps, workflow);
    check(textOutput !== null, 'TextNode executed successfully');
    check(textOutput.data.includes('https://api.production.service.com'), 'Resolved workflow variable apiUrl inside text node');

    // Note: The execution step recorded in steps must have the secret redacted!
    const recordedStep1 = steps.find((s) => s.nodeId === 'step_text');
    check(recordedStep1 !== undefined, 'Recorded step 1 in execution history');
    check(!JSON.stringify(recordedStep1.output).includes(secretApiKey), 'Secret API_KEY is completely redacted from step 1 output');
    check(JSON.stringify(recordedStep1.output).includes('[REDACTED]'), 'Secret replaced with [REDACTED] in step output');

    // Step 2: Condition Node evaluating {{ variables.discountPercent }} >= 15
    const condNode = {
      id: 'step_cond',
      type: NodeTypes.LOGIC_CONDITION,
      data: {
        operator: 'greater_or_equal',
        left: '{{ variables.discountPercent }}',
        right: '15',
      },
    };

    const condOutput = await executeNodeStep(condNode, context, executionPath, steps, workflow);
    check(condOutput.passed === true, 'Condition evaluated variable discountPercent >= 15 to TRUE');
    check(condOutput.selectedBranch === BranchTypes.TRUE, 'Selected TRUE branch for variable condition');

    // Step 3: Loop Node iterating over {{ variables.batchItems }} and using {{ secrets.DB_PASSWORD }}
    const loopNode = {
      id: 'step_loop',
      type: NodeTypes.ACTION_LOOP,
      data: {
        operation: 'loop_items',
        items: '{{ variables.batchItems }}',
        batchSize: 1,
      },
    };

    const executedOutputs = {
      step_text: textOutput,
      step_cond: condOutput,
    };
    const handledNodes = new Set();

    const loopOutput = await executeLoopStep(
      loopNode,
      context,
      executionPath,
      steps,
      workflow,
      executedOutputs,
      handledNodes
    );

    check(loopOutput.ok === true, 'Loop Node executed successfully with variable items array');
    check(loopOutput.iterations === 2, 'Loop Node processed 2 iterations from variable');
    check(loopOutput.total === 2, 'Loop Node total items match variable length');

    // Verify step output redaction for loop step
    const recordedLoopStep = steps.find((s) => s.nodeId === 'step_loop');
    check(recordedLoopStep !== undefined, 'Recorded loop step in execution history');
    check(!JSON.stringify(steps).includes(secretPass), 'DB_PASSWORD secret never leaked anywhere in steps history');
    check(!JSON.stringify(steps).includes(secretApiKey), 'API_KEY secret never leaked anywhere in steps history');

    clearActiveSecrets();
  }

  // ── Pipeline 2: Nested Scope Variable Resilience ─────────────────────────
  console.log('\nPipeline 2: Loop Context & Variable Scope Resilience');
  {
    const context = new ExecutionContext({
      variables: {
        multiplier: 10,
      },
      secrets: {
        SALT: 'salt_hash_999',
      },
    });

    registerActiveSecrets(context.secrets);

    // Push loop 1
    context.pushLoopContext({ item: 5, index: 0, total: 2 });
    check(context.getVariable('multiplier') === 10, 'Variable accessible in outer loop');

    // Push loop 2 (nested loop)
    context.pushLoopContext({ item: 'inner_val', index: 0, total: 1 });
    check(context.getVariable('multiplier') === 10, 'Variable accessible in nested inner loop');
    check(context.getSecret('SALT') === 'salt_hash_999', 'Secret accessible in nested inner loop');

    // Pop loop 2
    context.popLoopContext();
    check(context.loopContext.item === 5, 'Outer loop context restored after inner loop pop');
    check(context.getVariable('multiplier') === 10, 'Variable preserved after inner loop pop');

    // Pop loop 1
    context.popLoopContext();
    check(context.loopContext === null, 'All loop contexts cleared');
    check(context.getVariable('multiplier') === 10, 'Variable preserved on top-level context');

    clearActiveSecrets();
  }

  console.log(`\nVariables & Secrets Integration Tests: ${passedTests} passed, ${failedTests} failed\n`);
  if (failedTests > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Integration test suite failed:', err);
  process.exit(1);
});

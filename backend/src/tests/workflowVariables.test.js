/**
 * Comprehensive Unit Tests for Workflow Variables
 * Covers: Name validation, prototype pollution protection, type handling,
 * resolution syntax ({{variables.x}}, {{variable.x}}, {{vars.x}}),
 * raw value preservation, scope across loops/branches, and serialization.
 */

const assert = require('assert');
const { resolveVariable, resolveRawValue } = require('../utils/VariableResolver');
const ExecutionContext = require('../utils/ExecutionContext');
const { validateVariable, validateIdentifierName } = require('../validators/workflowVariableValidator');
const WorkflowSerializer = require('../services/WorkflowSerializer');

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
  console.log('\n🧪 Starting Workflow Variables Unit Tests...\n');

  // ── Group 1: Identifier Name Validation & Prototype Pollution Protection ─
  console.log('Group 1: Identifier Name Validation & Prototype Pollution');
  {
    const valid1 = validateIdentifierName('apiBaseUrl');
    check(valid1.valid === true && valid1.name === 'apiBaseUrl', 'Accepts camelCase variable name');

    const valid2 = validateIdentifierName('MAX_RETRIES_10');
    check(valid2.valid === true, 'Accepts UPPER_SNAKE_CASE with numbers');

    const valid3 = validateIdentifierName('_internal_flag');
    check(valid3.valid === true, 'Accepts leading underscore');

    const validHyphen = validateIdentifierName('kebab-var-name');
    check(validHyphen.valid === true, 'Accepts hyphens');

    // Reject Prototype Pollution attempts
    const proto1 = validateIdentifierName('__proto__');
    check(proto1.valid === false && proto1.error.includes('reserved'), 'Rejects __proto__ keyword');

    const proto2 = validateIdentifierName('constructor');
    check(proto2.valid === false && proto2.error.includes('reserved'), 'Rejects constructor keyword');

    const proto3 = validateIdentifierName('prototype');
    check(proto3.valid === false && proto3.error.includes('reserved'), 'Rejects prototype keyword');

    // Reject invalid chars / whitespace
    const invalidChar = validateIdentifierName('invalid var with spaces');
    check(invalidChar.valid === false, 'Rejects names containing spaces');

    const invalidChar2 = validateIdentifierName('123numberFirst');
    check(invalidChar2.valid === false, 'Rejects names starting with a digit');

    const emptyName = validateIdentifierName('');
    check(emptyName.valid === false, 'Rejects empty name');
  }

  // ── Group 2: Variable Type Coercion & Validation ─────────────────────────
  console.log('\nGroup 2: Variable Types (String, Number, Boolean, JSON)');
  {
    // String
    const strVar = validateVariable({ name: 'myStr', type: 'string', value: 12345 });
    check(strVar.valid === true && strVar.sanitized.value === '12345', 'String: coerces number to string');

    // Number
    const numVar = validateVariable({ name: 'myNum', type: 'number', value: '42.5' });
    check(numVar.valid === true && numVar.sanitized.value === 42.5, 'Number: parses string float to number');

    const numInvalid = validateVariable({ name: 'badNum', type: 'number', value: 'not_a_number' });
    check(numInvalid.valid === false && numInvalid.error.includes('not a valid number'), 'Number: rejects invalid number string');

    // Boolean
    const boolVar1 = validateVariable({ name: 'flagTrue', type: 'boolean', value: 'true' });
    check(boolVar1.valid === true && boolVar1.sanitized.value === true, 'Boolean: parses "true" to boolean true');

    const boolVar2 = validateVariable({ name: 'flagFalse', type: 'boolean', value: '0' });
    check(boolVar2.valid === true && boolVar2.sanitized.value === false, 'Boolean: parses "0" to boolean false');

    // JSON
    const jsonStr = validateVariable({
      name: 'appConfig',
      type: 'json',
      value: '{"env":"production","port":8080}',
    });
    check(
      jsonStr.valid === true && jsonStr.sanitized.value.env === 'production' && jsonStr.sanitized.value.port === 8080,
      'JSON: parses valid JSON string into object'
    );

    const jsonObj = validateVariable({
      name: 'tags',
      type: 'json',
      value: ['finance', 'audit'],
    });
    check(jsonObj.valid === true && Array.isArray(jsonObj.sanitized.value), 'JSON: accepts native array/object');

    const jsonInvalid = validateVariable({
      name: 'badJson',
      type: 'json',
      value: '{ invalid json }',
    });
    check(jsonInvalid.valid === false && jsonInvalid.error.includes('Invalid JSON'), 'JSON: rejects malformed JSON string');
  }

  // ── Group 3: Variable Resolution Syntax & Context Lookup ─────────────────
  console.log('\nGroup 3: Variable Resolution Syntax & Context Lookup');
  {
    const context = new ExecutionContext({
      variables: {
        apiHost: 'api.example.com',
        port: 443,
        useSsl: true,
        meta: {
          region: 'us-east-1',
          tier: 'enterprise',
        },
      },
    });

    // Syntax 1: {{ variables.variableName }}
    const res1 = resolveVariable('https://{{ variables.apiHost }}:{{ variables.port }}/v1', context);
    check(res1 === 'https://api.example.com:443/v1', 'Resolves {{ variables.variableName }} in string template');

    // Syntax 2: {{ variable.variableName }} (singular alias)
    const res2 = resolveVariable('Target host: {{ variable.apiHost }}', context);
    check(res2 === 'Target host: api.example.com', 'Resolves {{ variable.variableName }} alias');

    // Syntax 3: {{ vars.variableName }} (short alias)
    const res3 = resolveVariable('Target host: {{ vars.apiHost }}', context);
    check(res3 === 'Target host: api.example.com', 'Resolves {{ vars.variableName }} alias');

    // Nested JSON variable property
    const res4 = resolveVariable('Region: {{ variables.meta.region }}, Tier: {{ variables.meta.tier }}', context);
    check(res4 === 'Region: us-east-1, Tier: enterprise', 'Resolves nested JSON variable property {{ variables.meta.region }}');

    // Prototype pollution block in resolution
    const resProto = resolveVariable('{{ variables.__proto__.polluted }}', context);
    check(resProto === '', 'Prototype pollution in variable expression safely returns empty string');
  }

  // ── Group 4: Native Type Preservation via resolveRawValue ────────────────
  console.log('\nGroup 4: Native Type Preservation in resolveRawValue');
  {
    const context = new ExecutionContext({
      variables: {
        maxConcurrency: 10,
        featureFlag: false,
        activeFlag: true,
        clusterNodes: ['node-1', 'node-2'],
        dbSettings: { poolSize: 20 },
      },
    });

    // Number preservation
    const rawNum = resolveRawValue('{{ variables.maxConcurrency }}', context);
    check(typeof rawNum === 'number' && rawNum === 10, 'Preserves native number type');

    // Boolean false preservation
    const rawBoolFalse = resolveRawValue('{{ variables.featureFlag }}', context);
    check(typeof rawBoolFalse === 'boolean' && rawBoolFalse === false, 'Preserves native boolean false');

    // Boolean true preservation
    const rawBoolTrue = resolveRawValue('{{ variables.activeFlag }}', context);
    check(typeof rawBoolTrue === 'boolean' && rawBoolTrue === true, 'Preserves native boolean true');

    // Array preservation
    const rawArr = resolveRawValue('{{ variables.clusterNodes }}', context);
    check(Array.isArray(rawArr) && rawArr.length === 2 && rawArr[0] === 'node-1', 'Preserves native array reference');

    // Object preservation
    const rawObj = resolveRawValue('{{ variables.dbSettings }}', context);
    check(typeof rawObj === 'object' && rawObj.poolSize === 20, 'Preserves native object reference');
  }

  // ── Group 5: Precedence & Missing Variable Behavior ──────────────────────
  console.log('\nGroup 5: Precedence & Missing Variable Behavior');
  {
    const context = new ExecutionContext({
      initialResults: {
        step1: { data: { status: 'step1_active' } },
      },
      variables: {
        status: 'workflow_var_status',
        threshold: 99,
      },
    });

    // Explicit step reference takes precedence over variable
    const stepRef = resolveVariable('{{ steps.step1.data.status }}', context);
    check(stepRef === 'step1_active', 'Step reference resolves correctly');

    // Explicit variable reference resolves variable
    const varRef = resolveVariable('{{ variables.status }}', context);
    check(varRef === 'workflow_var_status', 'Explicit variable namespace resolves variable');

    // Missing variable returns empty string in template
    const missingTemplate = resolveVariable('Hello {{ variables.nonExistent }} World', context);
    check(missingTemplate === 'Hello  World', 'Missing variable produces empty string without throwing');

    // Missing variable in raw value returns empty string / undefined
    const missingRaw = resolveRawValue('{{ variables.nonExistent }}', context);
    check(missingRaw === '', 'Missing variable in resolveRawValue returns empty fallback');
  }

  // ── Group 6: Loop Scope & Nested Execution Compatibility ─────────────────
  console.log('\nGroup 6: Scope Accessibility in Loops & Branches');
  {
    const context = new ExecutionContext({
      variables: {
        taxMultiplier: 1.15,
      },
    });

    // Simulate pushLoopContext
    context.pushLoopContext({
      item: { id: 101, price: 100 },
      index: 0,
      total: 3,
    });

    // Loop iteration accesses both {{ loop.item.price }} and {{ variables.taxMultiplier }}
    const loopItemPrice = resolveRawValue('{{ loop.item.price }}', context);
    const varTax = resolveRawValue('{{ variables.taxMultiplier }}', context);

    check(loopItemPrice === 100, 'Loop context item resolved inside loop');
    check(varTax === 1.15, 'Workflow variable accessible inside loop scope');

    const combinedStr = resolveVariable('Item {{ item.id }} with tax {{ variables.taxMultiplier }}', context);
    check(combinedStr === 'Item 101 with tax 1.15', 'Interpolates loop item and workflow variable together');

    context.popLoopContext();
    check(context.loopContext === null, 'Loop context cleared after pop');
    check(context.getVariable('taxMultiplier') === 1.15, 'Workflow variable remains intact after loop context pop');
  }

  // ── Group 7: Serialization & Deserialization ─────────────────────────────
  console.log('\nGroup 7: Serialization & Deserialization Compatibility');
  {
    const testWorkflow = {
      name: 'Variables Pipeline',
      description: 'Testing variable round-trip serialization',
      nodes: [{ id: 'n1', type: 'trigger-manual', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
      edges: [],
      variables: [
        { name: 'apiKey', type: 'string', value: 'test-key', description: 'API Key' },
        { name: 'retries', type: 'number', value: 3, description: 'Max Retries' },
        { name: 'enabled', type: 'boolean', value: true, description: 'Is Enabled' },
        { name: 'config', type: 'json', value: { env: 'dev' }, description: 'Config' },
      ],
    };

    const serialized = WorkflowSerializer.serialize(testWorkflow);
    check(Array.isArray(serialized.workflow.variables), 'Serialized workflow contains variables array');
    check(serialized.workflow.variables.length === 4, 'Serialized all 4 variables');

    const deserialized = WorkflowSerializer.deserialize(serialized);
    check(Array.isArray(deserialized.variables), 'Deserialized workflow contains variables array');
    check(deserialized.variables.length === 4, 'Deserialized all 4 variables');
    check(deserialized.variables[1].name === 'retries' && deserialized.variables[1].value === 3, 'Preserved variable types');

    const roundTrip = WorkflowSerializer.roundTripTest(testWorkflow);
    check(roundTrip.success === true, 'Round-trip serialization preserves variables');
    check(roundTrip.checks.variablesPreserved === true, 'Round-trip checks.variablesPreserved verified');
  }

  console.log(`\nWorkflow Variables Tests: ${passedTests} passed, ${failedTests} failed\n`);
  if (failedTests > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});


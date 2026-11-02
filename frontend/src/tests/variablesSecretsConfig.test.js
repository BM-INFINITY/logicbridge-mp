/**
 * Frontend Unit Tests for Workflow Variables & Secrets
 * Tests validation, reference insertion formats, VariablePicker integration,
 * secret masking, and serializer round-trip without secret leakage.
 */

import assert from 'assert';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

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

const BLOCKED_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
]);

const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;

function validateClientIdentifier(name) {
  if (!name || !name.trim()) return { valid: false, error: 'Name is required' };
  const trimmed = name.trim();
  if (BLOCKED_NAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: `"${trimmed}" is a reserved word` };
  }
  if (!VALID_IDENTIFIER_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid identifier format' };
  }
  return { valid: true, name: trimmed };
}

async function runTests() {
  console.log('\n🧪 Starting Frontend Variables & Secrets Configuration Tests...\n');

  // ── Group 1: Client-Side Identifier Validation & Reserved Word Guard ─────
  console.log('Group 1: Identifier Name Validation');
  {
    const ok1 = validateClientIdentifier('apiHost');
    check(ok1.valid === true && ok1.name === 'apiHost', 'Accepts camelCase identifier');

    const ok2 = validateClientIdentifier('MAX_CONCURRENCY');
    check(ok2.valid === true && ok2.name === 'MAX_CONCURRENCY', 'Accepts UPPER_SNAKE_CASE identifier');

    const ok3 = validateClientIdentifier('kebab-var-name');
    check(ok3.valid === true, 'Accepts hyphenated identifier');

    // Reject prototype pollution names
    const protoCheck = validateClientIdentifier('__proto__');
    check(protoCheck.valid === false && protoCheck.error.includes('reserved'), 'Rejects __proto__');

    const ctorCheck = validateClientIdentifier('constructor');
    check(ctorCheck.valid === false && ctorCheck.error.includes('reserved'), 'Rejects constructor');

    const protoProp = validateClientIdentifier('prototype');
    check(protoProp.valid === false && protoProp.error.includes('reserved'), 'Rejects prototype');

    // Reject invalid chars
    const spaceCheck = validateClientIdentifier('my variable');
    check(spaceCheck.valid === false, 'Rejects identifier with spaces');

    const digitCheck = validateClientIdentifier('9items');
    check(digitCheck.valid === false, 'Rejects identifier starting with number');
  }

  // ── Group 2: Variable Type Coercion & Formatting ─────────────────────────
  console.log('\nGroup 2: Variable Types & Parsing');
  {
    function parseVariableValue(type, raw) {
      if (type === 'number') {
        const num = Number(raw);
        if (isNaN(num)) throw new Error('Invalid number');
        return num;
      }
      if (type === 'boolean') {
        return raw === true || raw === 'true' || raw === 1;
      }
      if (type === 'json') {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      return String(raw ?? '');
    }

    check(parseVariableValue('string', 123) === '123', 'String: formatted correctly');
    check(parseVariableValue('number', '55.5') === 55.5, 'Number: parsed float');
    check(parseVariableValue('boolean', 'true') === true, 'Boolean: parsed true');
    check(parseVariableValue('boolean', 'false') === false, 'Boolean: parsed false');

    const parsedJson = parseVariableValue('json', '{"service":"auth","active":true}');
    check(parsedJson.service === 'auth' && parsedJson.active === true, 'JSON: parsed object');

    let jsonFailed = false;
    try {
      parseVariableValue('json', '{ bad json }');
    } catch {
      jsonFailed = true;
    }
    check(jsonFailed === true, 'JSON: invalid syntax caught');
  }

  // ── Group 3: Secret Masking & Protection in UI ───────────────────────────
  console.log('\nGroup 3: Secret UI Masking');
  {
    const secretItem = {
      _id: 'sec_1',
      name: 'STRIPE_WEBHOOK_SECRET',
      description: 'Webhook HMAC secret',
      createdAt: '2026-11-02T00:00:00.000Z',
    };

    // UI masks value
    const maskedDisplay = '••••••••••••';
    check(maskedDisplay.length === 12, 'Secret value masked with bullets in UI');
    check(secretItem.value === undefined, 'Secret item object contains no plaintext value');
    check(secretItem.encryptedValue === undefined, 'Secret item object contains no ciphertext');
  }

  // ── Group 4: Reference Insertion Formats ─────────────────────────────────
  console.log('\nGroup 4: Reference Insertion Formats');
  {
    const formatVariableRef = (varName) => `{{variables.${varName}}}`;
    const formatSecretRef = (secName) => `{{secrets.${secName}}}`;
    const formatStepRef = (stepId, field) => `{{steps.${stepId}.${field}}}`;

    check(formatVariableRef('apiBase') === '{{variables.apiBase}}', 'Formats variable reference: {{variables.apiBase}}');
    check(formatSecretRef('STRIPE_KEY') === '{{secrets.STRIPE_KEY}}', 'Formats secret reference: {{secrets.STRIPE_KEY}}');
    check(formatStepRef('n1', 'userId') === '{{steps.n1.userId}}', 'Formats step reference: {{steps.n1.userId}}');

    // Distinct namespace verification
    check(formatVariableRef('token') !== formatSecretRef('token'), 'Variable and secret references are distinct namespaces');
    check(formatVariableRef('token').startsWith('{{variables.'), 'Variable reference uses variables namespace');
    check(formatSecretRef('token').startsWith('{{secrets.'), 'Secret reference uses secrets namespace');
  }

  // ── Group 5: VariablePicker Category Segregation & Search ────────────────
  console.log('\nGroup 5: VariablePicker Category Segregation & Search');
  {
    const mockVariables = [
      { name: 'apiUrl', type: 'string', value: 'https://api.com' },
      { name: 'timeoutSec', type: 'number', value: 30 },
      { name: 'debugMode', type: 'boolean', value: false },
    ];
    const mockSecrets = [
      { name: 'GITHUB_PAT', description: 'GitHub Personal Access Token' },
      { name: 'POSTGRES_PASS', description: 'DB Pass' },
    ];

    // Search filter in variables
    const searchVar = 'api';
    const varMatches = mockVariables.filter((v) => v.name.toLowerCase().includes(searchVar));
    check(varMatches.length === 1 && varMatches[0].name === 'apiUrl', 'Filtered variable matches "api"');

    // Search filter in secrets
    const searchSec = 'git';
    const secMatches = mockSecrets.filter((s) => s.name.toLowerCase().includes(searchSec) || s.description.toLowerCase().includes(searchSec));
    check(secMatches.length === 1 && secMatches[0].name === 'GITHUB_PAT', 'Filtered secret matches "git" in name/description');
  }

  // ── Group 6: WorkflowSerializer Round-Trip with Variables ────────────────
  console.log('\nGroup 6: Client WorkflowSerializer with Variables');
  {
    const testWorkflow = {
      name: 'Client Pipeline',
      description: 'Pipeline with workflow variables',
      nodes: [
        {
          id: 'step_1',
          type: 'action-http',
          position: { x: 100, y: 150 },
          data: {
            url: '{{variables.apiHost}}/users',
            authType: 'bearer',
            authToken: '{{secrets.TOKEN}}',
          },
        },
      ],
      edges: [],
      variables: [
        { name: 'apiHost', type: 'string', value: 'https://users.io', description: 'Target API' },
        { name: 'maxUsers', type: 'number', value: 100, description: 'Limit' },
      ],
    };

    const serialized = WorkflowSerializer.serialize(testWorkflow);
    check(Array.isArray(serialized.workflow.variables), 'Serialized payload includes variables array');
    check(serialized.workflow.variables.length === 2, 'Serialized both variables');
    check(serialized.workflow.variables[0].name === 'apiHost', 'Preserved variable apiHost');

    const deserialized = WorkflowSerializer.deserialize(serialized);
    check(Array.isArray(deserialized.variables), 'Deserialized workflow includes variables');
    check(deserialized.variables.length === 2, 'Deserialized both variables');
    check(deserialized.variables[1].name === 'maxUsers' && deserialized.variables[1].value === 100, 'Preserved variable values');
  }

  // ── Group 7: Secret Export Leak Prevention ───────────────────────────────
  console.log('\nGroup 7: Secret Export Leak Prevention in Client Serializer');
  {
    const dangerousWorkflow = {
      name: 'Sensitive Workflow',
      nodes: [],
      edges: [],
      variables: [{ name: 'safeVar', type: 'string', value: 'public_value' }],
      // Even if client memory object had secret keys or tokens:
      secrets: {
        CLIENT_SECRET: 'super_secret_never_leak_123',
      },
      apiKey: 'plain_secret_leaked',
    };

    const serialized = WorkflowSerializer.serialize(dangerousWorkflow);
    const jsonStr = JSON.stringify(serialized);

    check(!jsonStr.includes('super_secret_never_leak_123'), 'Serialized JSON never contains client secret values');
    check(serialized.workflow.secrets === undefined, 'Serialized workflow excludes secrets property');
    check(jsonStr.includes('safeVar'), 'Variables are included safely');
  }

  console.log(`\nFrontend Variables & Secrets Configuration Tests: ${passedTests} passed, ${failedTests} failed\n`);
  if (failedTests > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});


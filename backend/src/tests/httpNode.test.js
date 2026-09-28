const assert = require('assert');
const HttpNode = require('../nodes/HttpNode');
const ExecutionContext = require('../utils/ExecutionContext');
const { redactSecrets } = require('../utils/SecretRedactor');

let passed = 0;
let failed = 0;

function testAssert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting HTTP Node Capability Unit Tests...\n');

  const httpNode = new HttpNode();

  // ── Group 1: Validation Rules ─────────────────────────────────────────────
  console.log('Group 1: Node Validation Rules');

  const validRes = httpNode.validate({ data: { url: 'https://api.example.com/test', method: 'GET' } });
  testAssert(validRes.valid === true, 'Validates clean GET request configuration');

  const noUrlRes = httpNode.validate({ data: { url: '', method: 'GET' } });
  testAssert(noUrlRes.valid === false && noUrlRes.error.includes('URL'), 'Rejects empty URL');

  const badMethodRes = httpNode.validate({ data: { url: 'https://example.com', method: 'INVALID' } });
  testAssert(badMethodRes.valid === false && badMethodRes.error.includes('method'), 'Rejects invalid HTTP method');

  const badJsonRes = httpNode.validate({
    data: { url: 'https://example.com', method: 'POST', contentType: 'json', body: '{ invalid json }' },
  });
  testAssert(badJsonRes.valid === false && badJsonRes.error.includes('JSON'), 'Rejects malformed JSON body template');

  const bearerNoTokenRes = httpNode.validate({
    data: { url: 'https://example.com', authType: 'bearer', authToken: '' },
  });
  testAssert(bearerNoTokenRes.valid === false && bearerNoTokenRes.error.includes('Bearer Token'), 'Rejects missing Bearer token');

  const apiKeyNoValRes = httpNode.validate({
    data: { url: 'https://example.com', authType: 'api_key', apiKey: 'X-Key', apiValue: '' },
  });
  testAssert(apiKeyNoValRes.valid === false && apiKeyNoValRes.error.includes('API Key'), 'Rejects missing API key value');

  const badTimeoutRes = httpNode.validate({
    data: { url: 'https://example.com', timeout: 50 },
  });
  testAssert(badTimeoutRes.valid === false && badTimeoutRes.error.includes('Timeout'), 'Rejects out-of-bounds timeout (<100ms)');

  // ── Group 2: Methods & Backward Compatibility ─────────────────────────────
  console.log('\nGroup 2: Backward Compatibility & Methods');

  const oldPayload = {
    data: {
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      method: 'GET',
    },
  };
  const context1 = new ExecutionContext();
  try {
    const res = await httpNode.execute(oldPayload, context1);
    testAssert(res.status === 200, 'Executes legacy GET payload successfully');
    testAssert(res.data && res.data.id === 1, 'Returns valid response body from public test API');
    testAssert(res.attempts === 1, 'Records attempt count (1)');
    testAssert(typeof res.duration === 'number', 'Records duration (ms)');
  } catch (err) {
    testAssert(false, `Legacy GET request failed: ${err.message}`);
  }

  // ── Group 3: Variable Interpolation ───────────────────────────────────────
  console.log('\nGroup 3: Advanced Variable Interpolation');

  const multiStepContext = new ExecutionContext();
  multiStepContext.setResult('node_trigger', { body: { userId: 42, endpoint: 'todos' } });
  multiStepContext.setResult('node_prev', { queryVal: 'true' });

  const interpolatedPayload = {
    data: {
      url: 'https://jsonplaceholder.typicode.com/{{trigger.body.endpoint}}/1',
      method: 'GET',
      queryParamsList: [{ key: 'userId', value: '{{steps.node_trigger.body.userId}}' }],
      headersList: [{ key: 'X-Custom-User', value: 'User-{{steps.node_trigger.body.userId}}' }],
    },
  };

  try {
    const res = await httpNode.execute(interpolatedPayload, multiStepContext);
    testAssert(res.status === 200, 'Resolves {{trigger...}} and {{steps...}} expressions cleanly');
    testAssert(res.url.includes('todos/1'), 'Interpolated path correctly in URL');
    testAssert(res.url.includes('userId=42'), 'Interpolated query parameters cleanly');
  } catch (err) {
    testAssert(false, `Interpolated request failed: ${err.message}`);
  }

  // ── Group 4: Authentication Header Injection ──────────────────────────────
  console.log('\nGroup 4: Authentication Construction');

  const bearerPayload = {
    data: {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
      authType: 'bearer',
      authToken: 'secret_token_abc123',
    },
  };

  try {
    const res = await httpNode.execute(bearerPayload, new ExecutionContext());
    testAssert(res.status === 200, 'Executes Bearer auth request successfully');
    const authHeader = res.headers['Authorization'] || res.headers['authorization'];
    testAssert(authHeader === 'Bearer [REDACTED]' || authHeader === '[REDACTED]', 'Redacts Authorization header in return output');
  } catch (err) {
    testAssert(false, `Bearer auth request failed: ${err.message}`);
  }

  const basicAuthPayload = {
    data: {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
      authType: 'basic',
      authUsername: 'testuser',
      authPassword: 'testpassword',
    },
  };

  try {
    const res = await httpNode.execute(basicAuthPayload, new ExecutionContext());
    testAssert(res.status === 200, 'Executes Basic auth request successfully');
    const authHeader = res.headers['Authorization'] || res.headers['authorization'];
    testAssert(authHeader === 'Basic [REDACTED]' || authHeader === '[REDACTED]', 'Redacts Basic Authorization header in return output');
  } catch (err) {
    testAssert(false, `Basic auth request failed: ${err.message}`);
  }

  // ── Group 5: Secret Redaction Verification ────────────────────────────────
  console.log('\nGroup 5: Secret Redaction Verification');

  const sensitiveObj = {
    url: 'https://api.test.com',
    Authorization: 'Bearer super_secret_token_xyz',
    'x-api-key': 'secret_key_999',
    normalField: 'public_value',
    nested: {
      password: 'my_password_123',
      safeVal: 42,
    },
  };

  const redactedObj = redactSecrets(sensitiveObj);
  testAssert(redactedObj.Authorization === 'Bearer [REDACTED]' || redactedObj.Authorization === '[REDACTED]', 'Redacts Bearer authorization value');
  testAssert(redactedObj['x-api-key'] === '[REDACTED]', 'Redacts x-api-key value');
  testAssert(redactedObj.normalField === 'public_value', 'Preserves un-sensitive normal fields');
  testAssert(redactedObj.nested.password === '[REDACTED]', 'Redacts nested password fields');
  testAssert(redactedObj.nested.safeVal === 42, 'Preserves nested un-sensitive numbers');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME HTTP NODE TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL HTTP NODE CAPABILITY TESTS PASSED!\n');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };

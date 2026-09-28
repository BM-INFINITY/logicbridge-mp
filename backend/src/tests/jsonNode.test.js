/**
 * JsonNode Backend Unit Tests
 * Covers: parse, stringify, get, set, remove, variable resolution, error handling
 */

const assert = require('assert');
const JsonNode = require('../nodes/JsonNode');
const ExecutionContext = require('../utils/ExecutionContext');
const TransformNode = require('../nodes/TransformNode');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function runTests() {
  console.log('\n🧪 Starting JsonNode Unit Tests...\n');
  const json = new JsonNode();

  // ── Group 1: Parse ──────────────────────────────────────────────────────────
  console.log('Group 1: Parse');

  const parseObjRes = await json.execute({ data: { operation: 'parse', input: '{"name":"Dhruv","age":20}' } }, { lastOutput: null });
  check(parseObjRes.operation === 'parse', 'Returns operation = parse');
  check(parseObjRes.data.name === 'Dhruv', 'Parse object: name field correct');
  check(parseObjRes.data.age === 20, 'Parse object: age field correct (number type)');

  const parseArrRes = await json.execute({ data: { operation: 'parse', input: '[1,2,3]' } }, { lastOutput: null });
  check(Array.isArray(parseArrRes.data), 'Parse array: returns array');
  check(parseArrRes.data.length === 3, 'Parse array: length is 3');

  // When input is empty, parse should fail with NodeExecutionError
  const parseEmptyErr = await json.execute({ data: { operation: 'parse', input: '  ' } }, { lastOutput: null }).catch((e) => ({ _error: e.message }));
  check(parseEmptyErr._error && (parseEmptyErr._error.includes('empty') || parseEmptyErr._error.includes('input')), 'Parse rejects empty/whitespace input');

  const parseInvalidErr = await json.execute({ data: { operation: 'parse', input: '{ not valid }' } }, { lastOutput: null }).catch((e) => ({ _error: e.message }));
  check(parseInvalidErr._error && parseInvalidErr._error.includes('invalid JSON'), 'Parse rejects invalid JSON string');

  // ── Group 2: Stringify ──────────────────────────────────────────────────────
  console.log('\nGroup 2: Stringify');

  const ctx1 = new ExecutionContext();
  ctx1.lastOutput = { name: 'Dhruv', active: true };
  const strRes = await json.execute({ data: { operation: 'stringify', input: '' } }, ctx1);
  check(typeof strRes.data === 'string', 'Stringify returns string');
  check(strRes.data.includes('"name":"Dhruv"') || strRes.data.includes('"name": "Dhruv"'), 'Stringify contains correct key');

  const prettyRes = await json.execute({ data: { operation: 'stringify', input: '', pretty: true } }, ctx1);
  check(prettyRes.data.includes('\n'), 'Pretty stringify contains newlines');
  check(prettyRes.data.includes('  '), 'Pretty stringify contains indentation');

  // ── Group 3: Get Property ───────────────────────────────────────────────────
  console.log('\nGroup 3: Get Property');

  const ctx2 = new ExecutionContext();
  ctx2.lastOutput = { user: { profile: { email: 'dhruv@test.com' } } };
  const getRes = await json.execute({ data: { operation: 'get', input: '', path: 'user.profile.email' } }, ctx2);
  check(getRes.data === 'dhruv@test.com', 'Get nested property via dot-notation');

  const ctx3 = new ExecutionContext();
  ctx3.lastOutput = { a: 1, b: { c: 42 } };
  const getShallowRes = await json.execute({ data: { operation: 'get', input: '', path: 'b.c' } }, ctx3);
  check(getShallowRes.data === 42, 'Get two-level nested property');

  const getMissingRes = await json.execute({ data: { operation: 'get', input: '', path: 'x.y.z' } }, ctx3);
  check(getMissingRes.data === undefined, 'Missing property returns undefined (no error)');

  // ── Group 4: Set Property ───────────────────────────────────────────────────
  console.log('\nGroup 4: Set Property');

  const ctx4 = new ExecutionContext();
  ctx4.lastOutput = { name: 'Old', score: 100 };
  const setRes = await json.execute({ data: { operation: 'set', input: '', path: 'name', value: 'New' } }, ctx4);
  check(setRes.data.name === 'New', 'Set shallow property updates value');
  check(setRes.data.score === 100, 'Set shallow property preserves other fields');

  const setNestedInput = { name: 'Old', score: 100 };
  const setNestedCtx = new ExecutionContext();
  setNestedCtx.lastOutput = setNestedInput;
  const setNestedRes = await json.execute({ data: { operation: 'set', input: '', path: 'meta.version', value: 'v2.0' } }, setNestedCtx);
  check(setNestedRes.data?.meta?.version === 'v2.0', 'Set creates nested path if not exists');

  // ── Group 5: Remove Property ────────────────────────────────────────────────
  console.log('\nGroup 5: Remove Property');

  const ctx5 = new ExecutionContext();
  ctx5.lastOutput = { keep: 'yes', drop: 'no' };
  const removeRes = await json.execute({ data: { operation: 'remove', input: '', path: 'drop' } }, ctx5);
  check(removeRes.data.keep === 'yes', 'Remove preserves other fields');
  check(!('drop' in removeRes.data), 'Remove deletes specified field');

  const removeNestedCtx = new ExecutionContext();
  removeNestedCtx.lastOutput = { a: { b: { c: 1 }, d: 2 } };
  const removeNestedRes = await json.execute({ data: { operation: 'remove', input: '', path: 'a.b' } }, removeNestedCtx);
  check(removeNestedRes.data.a.d === 2, 'Remove nested: sibling preserved');
  check(!removeNestedRes.data.a.b, 'Remove nested: target deleted');

  // ── Group 6: Validation ──────────────────────────────────────────────────────
  console.log('\nGroup 6: Validation');

  check(json.validate({ data: {} }).valid === false, 'Rejects missing operation');
  check(json.validate({ data: { operation: 'unknown' } }).valid === false, 'Rejects unsupported operation');
  check(json.validate({ data: { operation: 'parse', input: '' } }).valid === false, 'Rejects parse with empty input');
  check(json.validate({ data: { operation: 'get', path: '' } }).valid === false, 'Rejects get with no path');
  check(json.validate({ data: { operation: 'remove', path: '' } }).valid === false, 'Rejects remove with no path');
  check(json.validate({ data: { operation: 'parse', input: '{"x":1}' } }).valid === true, 'Accepts valid parse config');
  check(json.validate({ data: { operation: 'get', path: 'user.name' } }).valid === true, 'Accepts valid get config');
  check(json.validate({ data: { operation: 'stringify' } }).valid === true, 'Accepts stringify (no required fields beyond operation)');

  // ── Group 7: Variable Resolution ────────────────────────────────────────────
  console.log('\nGroup 7: Variable Resolution');

  const ctxVar = new ExecutionContext();
  ctxVar.setResult('fetchStep', { body: '{"id":99,"email":"test@example.com"}' });
  ctxVar.lastOutput = { body: '{"id":99,"email":"test@example.com"}' };
  const varParseRes = await json.execute({ data: { operation: 'parse', input: '{{prev.body}}' } }, ctxVar);
  check(varParseRes.data.id === 99, 'Resolves {{prev.body}} and parses JSON string');
  check(varParseRes.data.email === 'test@example.com', 'Parsed email field accessible after variable resolution');

  // ── Group 8: JSON → Transform Integration ───────────────────────────────────
  console.log('\nGroup 8: JSON → Transform Integration');

  const httpCtx = new ExecutionContext();
  const rawPayload = '{"user":{"name":"Alice","role":"admin"},"score":95}';
  const jsonParseRes = await json.execute({ data: { operation: 'parse', input: rawPayload } }, httpCtx);
  httpCtx.setResult('json_node', jsonParseRes);
  httpCtx.lastOutput = jsonParseRes;

  const transform = new TransformNode();
  const transformRes = await transform.execute({
    data: {
      operation: 'map',
      mappings: [
        { outputField: 'userName', source: '{{prev.data.user.name}}' },
        { outputField: 'userRole', source: '{{prev.data.user.role}}' },
        { outputField: 'userScore', source: '{{prev.data.score}}' },
      ],
    },
  }, httpCtx);
  check(transformRes.data.userName === 'Alice', 'JSON→Transform: extracts user.name');
  check(transformRes.data.userRole === 'admin', 'JSON→Transform: extracts user.role');
  check(Number(transformRes.data.userScore) === 95, 'JSON→Transform: extracts score');

  // ── Report ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) { console.error('❌ SOME JSON NODE TESTS FAILED\n'); process.exit(1); }
  else              console.log('🎉 ALL JSON NODE TESTS PASSED!\n\n');
}

runTests().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });

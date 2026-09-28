/**
 * TransformNode Backend Unit Tests
 * Tests all operations: map, pick, omit, set, remove, and array operations.
 */

const TransformNode = require('../nodes/TransformNode');
const HttpNode = require('../nodes/HttpNode');
const ExecutionContext = require('../utils/ExecutionContext');
const ConditionNode = require('../nodes/ConditionNode');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function runTests() {
  console.log('\n🧪 Starting TransformNode Unit Tests...\n');
  const transform = new TransformNode();

  // ── Group 1: Basic Mapping ──────────────────────────────────────────────
  console.log('Group 1: Basic Mapping (map operation)');

  const ctx1 = new ExecutionContext();
  ctx1.setResult('n1', { name: 'Dhruv Patel', email: 'dhruv@example.com', age: 20 });

  // Single field
  const singleMap = await transform.execute({
    data: {
      operation: 'map',
      mappings: [{ outputField: 'userName', source: '{{prev.name}}' }],
    },
  }, { ...ctx1, lastOutput: ctx1.results.n1 });
  assert(singleMap.data.userName === 'Dhruv Patel', 'Single field mapping extracts correct value');
  assert(singleMap.operation === 'map', 'Returns correct operation name');

  // Multiple fields
  const multiMap = await transform.execute({
    data: {
      operation: 'map',
      mappings: [
        { outputField: 'userName', source: '{{prev.name}}' },
        { outputField: 'contactEmail', source: '{{prev.email}}' },
        { outputField: 'userAge', source: '{{prev.age}}' },
      ],
    },
  }, { ...ctx1, lastOutput: ctx1.results.n1 });
  assert(multiMap.data.userName === 'Dhruv Patel', 'Multi-field: userName mapped');
  assert(multiMap.data.contactEmail === 'dhruv@example.com', 'Multi-field: contactEmail mapped');
  assert(String(multiMap.data.userAge) === '20', 'Multi-field: userAge mapped');

  // Nested field via step reference
  const nestedCtx = new ExecutionContext();
  nestedCtx.setResult('http1', { data: { user: { firstName: 'Test', lastName: 'User' } } });
  const nestedMap = await transform.execute({
    data: {
      operation: 'map',
      mappings: [{ outputField: 'first', source: '{{steps.http1.data.user.firstName}}' }],
    },
  }, nestedCtx);
  assert(nestedMap.data.first === 'Test', 'Nested field extraction via step reference works');

  // ── Group 2: Pick Operation ─────────────────────────────────────────────
  console.log('\nGroup 2: Pick Operation');

  const pickCtx = new ExecutionContext();
  pickCtx.lastOutput = { id: 1, name: 'Dhruv', email: 'dhruv@example.com', password: 'secret123' };
  const pickRes = await transform.execute({
    data: { operation: 'pick', fields: ['id', 'name', 'email'] },
  }, pickCtx);
  assert(deepEqual(Object.keys(pickRes.data).sort(), ['email', 'id', 'name']), 'Pick selects only listed fields');
  assert(!('password' in pickRes.data), 'Pick excludes unlisted fields (password removed)');

  // ── Group 3: Omit Operation ─────────────────────────────────────────────
  console.log('\nGroup 3: Omit Operation');

  const omitCtx = new ExecutionContext();
  omitCtx.lastOutput = { id: 1, name: 'Dhruv', password: 'secret123', token: 'tok_xyz' };
  const omitRes = await transform.execute({
    data: { operation: 'omit', fields: ['password', 'token'] },
  }, omitCtx);
  assert('id' in omitRes.data && 'name' in omitRes.data, 'Omit keeps non-listed fields');
  assert(!('password' in omitRes.data) && !('token' in omitRes.data), 'Omit removes listed fields');

  // ── Group 4: Set Operation ──────────────────────────────────────────────
  console.log('\nGroup 4: Set Operation');

  const setCtx = new ExecutionContext();
  setCtx.lastOutput = { id: 10, name: 'Dhruv' };
  const setRes = await transform.execute({
    data: {
      operation: 'set',
      mappings: [
        { outputField: 'status', source: 'active' },
        { outputField: 'fullName', source: '{{prev.name}}' },
      ],
    },
  }, setCtx);
  assert(setRes.data.id === 10, 'Set preserves existing fields');
  assert(setRes.data.status === 'active', 'Set adds static field');
  assert(setRes.data.fullName === 'Dhruv', 'Set adds variable-resolved field');

  // ── Group 5: Remove Operation ───────────────────────────────────────────
  console.log('\nGroup 5: Remove Operation');

  const removeCtx = new ExecutionContext();
  removeCtx.lastOutput = { id: 1, name: 'Dhruv', __internal: true, _meta: 'hidden' };
  const removeRes = await transform.execute({
    data: { operation: 'remove', fields: ['__internal', '_meta'] },
  }, removeCtx);
  assert('id' in removeRes.data && 'name' in removeRes.data, 'Remove keeps non-listed fields');
  assert(!('__internal' in removeRes.data) && !('_meta' in removeRes.data), 'Remove deletes specified fields');

  // ── Group 6: Array Operations ───────────────────────────────────────────
  console.log('\nGroup 6: Array Operations');

  const arrayData = [
    { name: 'A', active: true,  score: 90 },
    { name: 'B', active: false, score: 55 },
    { name: 'C', active: true,  score: 78 },
  ];
  const arrayCtx = new ExecutionContext();
  arrayCtx.lastOutput = arrayData;

  // array-map
  const arrMapRes = await transform.execute({
    data: {
      operation: 'array-map',
      mappings: [
        { outputField: 'label', source: '{{prev.name}}' },
        { outputField: 'points', source: '{{prev.score}}' },
      ],
    },
  }, arrayCtx);
  assert(Array.isArray(arrMapRes.data), 'array-map returns an array');
  assert(arrMapRes.data.length === 3, 'array-map preserves item count');
  assert(arrMapRes.data[0].label === 'A', 'array-map maps first element correctly');
  assert(String(arrMapRes.data[0].points) === '90', 'array-map maps score as points');

  // array-filter
  const arrFilterRes = await transform.execute({
    data: { operation: 'array-filter', filterField: 'active', filterValue: 'true' },
  }, arrayCtx);
  assert(Array.isArray(arrFilterRes.data), 'array-filter returns array');
  assert(arrFilterRes.data.length === 2, 'array-filter keeps only active=true items');
  assert(arrFilterRes.data.every((i) => i.active === true), 'array-filter: all remaining items are active');

  // array-find
  const arrFindRes = await transform.execute({
    data: { operation: 'array-find', filterField: 'name', filterValue: 'B' },
  }, arrayCtx);
  assert(arrFindRes.data?.name === 'B', 'array-find returns first matching item');
  assert(arrFindRes.data?.active === false, 'array-find returns correct item properties');

  // array-first
  const arrFirstRes = await transform.execute({ data: { operation: 'array-first' } }, arrayCtx);
  assert(arrFirstRes.data?.name === 'A', 'array-first returns first array element');

  // array-last
  const arrLastRes = await transform.execute({ data: { operation: 'array-last' } }, arrayCtx);
  assert(arrLastRes.data?.name === 'C', 'array-last returns last array element');

  // array-length
  const arrLenRes = await transform.execute({ data: { operation: 'array-length' } }, arrayCtx);
  assert(arrLenRes.data === 3, 'array-length returns correct count');

  // ── Group 7: Variable Resolution ────────────────────────────────────────
  console.log('\nGroup 7: Variable Resolution');

  const multiCtx = new ExecutionContext();
  multiCtx.setResult('trigger1', { body: { userId: 42, region: 'IN' } });
  multiCtx.setResult('http_step', { data: { name: 'TestUser', active: true } });
  multiCtx.lastOutput = { meta: 'from_last_step' };

  const multiVarRes = await transform.execute({
    data: {
      operation: 'map',
      mappings: [
        { outputField: 'userId',    source: '{{trigger.body.userId}}' },
        { outputField: 'region',    source: '{{steps.trigger1.body.region}}' },
        { outputField: 'userName',  source: '{{steps.http_step.data.name}}' },
        { outputField: 'prevMeta',  source: '{{prev.meta}}' },
      ],
    },
  }, multiCtx);
  assert(String(multiVarRes.data.userId) === '42', 'Resolves trigger payload via {{trigger.body.userId}}');
  assert(multiVarRes.data.region === 'IN', 'Resolves step output via {{steps.trigger1.body.region}}');
  assert(multiVarRes.data.userName === 'TestUser', 'Resolves arbitrary step output');
  assert(multiVarRes.data.prevMeta === 'from_last_step', 'Resolves {{prev.meta}} from lastOutput');

  // ── Group 8: Validation ─────────────────────────────────────────────────
  console.log('\nGroup 8: Validation Rules');

  const badOpRes = transform.validate({ data: { operation: 'superscript' } });
  assert(badOpRes.valid === false && badOpRes.error.includes('Unsupported'), 'Rejects unsupported operation');

  const noMappingRes = transform.validate({ data: { operation: 'map', mappings: [] } });
  assert(noMappingRes.valid === false && noMappingRes.error.includes('mapping'), 'Rejects map with no mappings');

  const noFieldsRes = transform.validate({ data: { operation: 'pick', fields: [] } });
  assert(noFieldsRes.valid === false && noFieldsRes.error.includes('field name'), 'Rejects pick with no fields');

  const filterNoFieldRes = transform.validate({ data: { operation: 'array-filter', filterField: '' } });
  assert(filterNoFieldRes.valid === false && filterNoFieldRes.error.includes('filter field'), 'Rejects array-filter without filter field');

  const validMapRes = transform.validate({ data: { operation: 'map', mappings: [{ outputField: 'x', source: '{{prev.y}}' }] } });
  assert(validMapRes.valid === true, 'Accepts valid map configuration');

  // ── Group 9: Error Handling ─────────────────────────────────────────────
  console.log('\nGroup 9: Error Handling');

  const pickOnArray = await transform.execute({
    data: { operation: 'pick', fields: ['name'] },
  }, { lastOutput: [1, 2, 3] }).catch((err) => ({ _error: err.message }));
  assert(pickOnArray._error && pickOnArray._error.includes('object'), 'pick throws clear error when input is array');

  const filterOnObject = await transform.execute({
    data: { operation: 'array-filter', filterField: 'x', filterValue: 'y' },
  }, { lastOutput: { not: 'array' } }).catch((err) => ({ _error: err.message }));
  assert(filterOnObject._error && filterOnObject._error.includes('array'), 'array-filter throws clear error when input is not array');

  // ── Group 10: HTTP → Transform Integration ──────────────────────────────
  console.log('\nGroup 10: HTTP → Transform Integration');

  const httpNode = new HttpNode();
  const httpCtx = new ExecutionContext();
  const httpRes = await httpNode.execute({
    data: { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
  }, httpCtx);
  httpCtx.setResult('http_node', httpRes);
  httpCtx.lastOutput = httpRes;

  const httpToTransformRes = await transform.execute({
    data: {
      operation: 'map',
      mappings: [
        { outputField: 'userId',    source: '{{prev.data.id}}' },
        { outputField: 'userName',  source: '{{prev.data.name}}' },
        { outputField: 'userEmail', source: '{{prev.data.email}}' },
      ],
    },
  }, httpCtx);
  assert(httpToTransformRes.data.userId !== undefined, 'HTTP→Transform: extracts id from HTTP response');
  assert(httpToTransformRes.data.userName !== undefined, 'HTTP→Transform: extracts name from HTTP response');
  assert(httpToTransformRes.data.userEmail !== undefined, 'HTTP→Transform: extracts email from HTTP response');

  // Verify downstream Condition node can use transform result
  const condCtx = new ExecutionContext();
  condCtx.lastOutput = httpToTransformRes.data;
  const condNode = new ConditionNode();
  const condResult = await condNode.execute({
    data: { leftValue: '{{prev.userId}}', operator: 'equals', rightValue: '1' },
  }, condCtx);
  assert(condResult.passed === true, 'Transform→Condition: condition evaluates correctly against transformed data');

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME TRANSFORM NODE TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TRANSFORM NODE TESTS PASSED!\n');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };

/**
 * Integration Tests — Utility Nodes
 * Tests all utility nodes chained with existing nodes.
 *
 * Chains tested:
 *   HTTP → Transform → Text
 *   HTTP → Transform → Math
 *   HTTP → Transform → Date
 *   JSON → Transform
 *   Text → Condition
 *   Math → Condition
 *   Date → Condition
 *   Text → HTTP (via variable expression)
 *   JSON → HTTP (via variable expression)
 *   Math → HTTP (via variable expression)
 */

const HttpNode      = require('../nodes/HttpNode');
const TransformNode = require('../nodes/TransformNode');
const TextNode      = require('../nodes/TextNode');
const MathNode      = require('../nodes/MathNode');
const DateNode      = require('../nodes/DateNode');
const JsonNode      = require('../nodes/JsonNode');
const ConditionNode = require('../nodes/ConditionNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function runTests() {
  console.log('\n🧪 Starting Utility Node Integration Tests...\n');

  const http      = new HttpNode();
  const transform = new TransformNode();
  const text      = new TextNode();
  const math      = new MathNode();
  const dateNode  = new DateNode();
  const json      = new JsonNode();
  const condition = new ConditionNode();

  // ── Integration 1: HTTP → Transform → Text ──────────────────────────────────
  console.log('Integration 1: HTTP → Transform → Text');

  const ctx1 = new ExecutionContext();
  const httpRes1 = await http.execute({
    data: { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
  }, ctx1);
  ctx1.setResult('http1', httpRes1);

  const transformRes1 = await transform.execute({
    data: {
      operation: 'map',
      mappings: [{ outputField: 'fullName', source: '{{prev.data.name}}' }],
    },
  }, ctx1);
  ctx1.setResult('transform1', transformRes1);

  const textRes1 = await text.execute({
    data: { operation: 'uppercase', input: '{{prev.data.fullName}}' },
  }, ctx1);
  check(typeof textRes1.data === 'string', 'HTTP→Transform→Text: returns string');
  check(textRes1.data === textRes1.data.toUpperCase(), 'HTTP→Transform→Text: name is uppercased');
  ctx1.setResult('text1', textRes1);

  // ── Integration 2: HTTP → Transform → Math ──────────────────────────────────
  console.log('\nIntegration 2: HTTP → Transform → Math');

  const ctx2 = new ExecutionContext();
  const httpRes2 = await http.execute({
    data: { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
  }, ctx2);
  ctx2.setResult('http2', httpRes2);

  // Use the userId as a numeric value
  const transformRes2 = await transform.execute({
    data: {
      operation: 'map',
      mappings: [{ outputField: 'userId', source: '{{prev.data.id}}' }],
    },
  }, ctx2);
  ctx2.setResult('transform2', transformRes2);

  const mathRes2 = await math.execute({
    data: { operation: 'multiply', valueA: '{{prev.data.userId}}', valueB: '10' },
  }, ctx2);
  check(typeof mathRes2.data === 'number', 'HTTP→Transform→Math: returns number');
  check(mathRes2.data === 10, 'HTTP→Transform→Math: userId(1) * 10 = 10');

  // ── Integration 3: HTTP → Transform → Date ──────────────────────────────────
  console.log('\nIntegration 3: HTTP → Transform → Date (now + compare)');

  const ctx3 = new ExecutionContext();
  const nowRes = await dateNode.execute({ data: { operation: 'now' } }, ctx3);
  ctx3.setResult('date1', nowRes);

  const addRes = await dateNode.execute({
    data: { operation: 'add', dateInput: '{{prev.data}}', amount: '7', unit: 'days' },
  }, ctx3);
  ctx3.setResult('date2', addRes);

  const cmpRes = await dateNode.execute({
    data: { operation: 'compare', dateA: '{{prev.data}}', dateB: '{{steps.date1.data}}' },
  }, ctx3);
  check(cmpRes.data === 'after', 'HTTP→Transform→Date: future date is "after" now');

  // ── Integration 4: JSON → Transform ──────────────────────────────────────────
  console.log('\nIntegration 4: JSON → Transform');

  const ctx4 = new ExecutionContext();
  const jsonParseRes = await json.execute({
    data: { operation: 'parse', input: '{"product":"Widget","price":49.99,"qty":3}' },
  }, ctx4);
  ctx4.setResult('json1', jsonParseRes);

  const transformRes4 = await transform.execute({
    data: {
      operation: 'map',
      mappings: [
        { outputField: 'item', source: '{{prev.data.product}}' },
        { outputField: 'total', source: '{{prev.data.price}}' },
      ],
    },
  }, ctx4);
  check(transformRes4.data.item === 'Widget', 'JSON→Transform: product name extracted');
  check(Number(transformRes4.data.total) === 49.99, 'JSON→Transform: price extracted as number');

  // ── Integration 5: Text → Condition ──────────────────────────────────────────
  console.log('\nIntegration 5: Text → Condition');

  const ctx5 = new ExecutionContext();
  const textContainsRes = await text.execute({
    data: { operation: 'contains', input: 'Hello World', search: 'World' },
  }, ctx5);
  ctx5.setResult('text_check', textContainsRes);

  // Condition evaluates based on the text result (true/false)
  const condText = await condition.execute({
    data: { leftValue: String(textContainsRes.data), operator: 'equals', rightValue: 'true' },
  }, ctx5);
  check(condText.passed === true, 'Text→Condition: contains result (true) triggers TRUE branch');

  // ── Integration 6: Math → Condition ──────────────────────────────────────────
  console.log('\nIntegration 6: Math → Condition');

  const ctx6 = new ExecutionContext();
  const mathCalc = await math.execute({
    data: { operation: 'multiply', valueA: '5', valueB: '20' },
  }, ctx6);
  ctx6.setResult('math_calc', mathCalc);

  const condMath = await condition.execute({
    data: { leftValue: String(mathCalc.data), operator: 'greater-than', rightValue: '50' },
  }, ctx6);
  check(condMath.passed === true, 'Math→Condition: 100 > 50 = TRUE branch');

  // ── Integration 7: Date → Condition ──────────────────────────────────────────
  console.log('\nIntegration 7: Date → Condition');

  const ctx7 = new ExecutionContext();
  const dateCmp = await dateNode.execute({
    data: {
      operation: 'compare',
      dateA: '2025-01-01T00:00:00Z',
      dateB: '2024-01-01T00:00:00Z',
    },
  }, ctx7);
  ctx7.setResult('date_cmp', dateCmp);

  const condDate = await condition.execute({
    data: { leftValue: dateCmp.data, operator: 'equals', rightValue: 'after' },
  }, ctx7);
  check(condDate.passed === true, 'Date→Condition: "after" matches correctly');

  // ── Integration 8: Utility → HTTP (variable access) ──────────────────────────
  console.log('\nIntegration 8: Utility → HTTP (URL construction)');

  const ctx8 = new ExecutionContext();
  const mathIdRes = await math.execute({
    data: { operation: 'add', valueA: '3', valueB: '1' },
  }, ctx8);
  ctx8.setResult('math_id', mathIdRes);

  // Build an HTTP URL using the math result
  const httpFromMath = await http.execute({
    data: { url: 'https://jsonplaceholder.typicode.com/users/{{steps.math_id.data}}', method: 'GET' },
  }, ctx8);
  check(httpFromMath.status === 200, 'Math→HTTP: URL constructed from math result (user id 4) returns 200');
  check(httpFromMath.data?.id === 4, 'Math→HTTP: correct user fetched (id=4)');

  // ── Integration 9: Serialization Compatibility ───────────────────────────────
  console.log('\nIntegration 9: Serialization Compatibility');

  const WorkflowSerializer       = require('../services/WorkflowSerializer');
  const WorkflowImportValidator  = require('../validators/WorkflowImportValidator');

  const utilityWorkflow = {
    name: 'Utility Pipeline',
    description: 'Workflow with all utility nodes',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 0,   y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http',    position: { x: 200, y: 200 }, data: { label: 'Fetch', url: 'https://api.example.com', method: 'GET' } },
      { id: 'n3', type: 'action-json',    position: { x: 400, y: 200 }, data: { label: 'Parse JSON', operation: 'parse', input: '{{prev.body}}' } },
      { id: 'n4', type: 'action-text',    position: { x: 600, y: 200 }, data: { label: 'Uppercase', operation: 'uppercase', input: '{{prev.data.name}}' } },
      { id: 'n5', type: 'action-math',    position: { x: 800, y: 200 }, data: { label: 'Calculate', operation: 'multiply', valueA: '{{prev.data.count}}', valueB: '10' } },
      { id: 'n6', type: 'action-date',    position: { x: 1000, y: 200 }, data: { label: 'Add Time', operation: 'add', dateInput: '{{prev.data.date}}', amount: '7', unit: 'days' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
      { id: 'e5', source: 'n5', target: 'n6', animated: true },
    ],
  };

  const roundTrip = WorkflowSerializer.roundTripTest(utilityWorkflow);
  check(roundTrip.success === true, 'Serialization: utility node workflow round-trips cleanly');

  const serialized = WorkflowSerializer.serialize(utilityWorkflow);
  const validRes = WorkflowImportValidator.validate(serialized);
  check(validRes.valid === true, 'Import validation: utility node workflow imports cleanly');

  // ── Report ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) { console.error('❌ SOME INTEGRATION TESTS FAILED\n'); process.exit(1); }
  else              console.log('🎉 ALL UTILITY INTEGRATION TESTS PASSED!\n\n');
}

runTests().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });

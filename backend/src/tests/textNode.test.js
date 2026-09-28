/**
 * TextNode Backend Unit Tests
 * Covers: all 11 operations, variable resolution, error handling, empty input
 */

const assert = require('assert');
const TextNode = require('../nodes/TextNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function runTests() {
  console.log('\n🧪 Starting TextNode Unit Tests...\n');
  const text = new TextNode();
  const ctx  = new ExecutionContext();

  // ── Group 1: Case Operations ────────────────────────────────────────────────
  console.log('Group 1: Case Operations');

  const upRes = await text.execute({ data: { operation: 'uppercase', input: 'hello world' } }, ctx);
  check(upRes.data === 'HELLO WORLD', 'Uppercase: correct output');
  check(upRes.operation === 'uppercase', 'Uppercase: operation field set');

  const lowRes = await text.execute({ data: { operation: 'lowercase', input: 'HELLO WORLD' } }, ctx);
  check(lowRes.data === 'hello world', 'Lowercase: correct output');

  // ── Group 2: Trim ───────────────────────────────────────────────────────────
  console.log('\nGroup 2: Trim');

  const trimRes = await text.execute({ data: { operation: 'trim', input: '  hello  ' } }, ctx);
  check(trimRes.data === 'hello', 'Trim: removes surrounding whitespace');

  const trimNoneRes = await text.execute({ data: { operation: 'trim', input: 'no spaces' } }, ctx);
  check(trimNoneRes.data === 'no spaces', 'Trim: unchanged when no surrounding whitespace');

  // ── Group 3: Replace ────────────────────────────────────────────────────────
  console.log('\nGroup 3: Replace');

  const replaceRes = await text.execute({ data: { operation: 'replace', input: 'Hello Dhruv', find: 'Dhruv', replace: 'User' } }, ctx);
  check(replaceRes.data === 'Hello User', 'Replace: substitutes correctly');

  const replaceAllRes = await text.execute({ data: { operation: 'replace', input: 'a-b-c-a', find: 'a', replace: 'X' } }, ctx);
  check(replaceAllRes.data === 'X-b-c-X', 'Replace: replaces ALL occurrences');

  const replaceEmptyRes = await text.execute({ data: { operation: 'replace', input: 'test', find: 'x', replace: 'Y' } }, ctx);
  check(replaceEmptyRes.data === 'test', 'Replace: no match leaves string unchanged');

  // ── Group 4: Contains / StartsWith / EndsWith ────────────────────────────────
  console.log('\nGroup 4: Contains / Starts With / Ends With');

  const containsTrueRes  = await text.execute({ data: { operation: 'contains',   input: 'Hello World', search: 'World' } }, ctx);
  const containsFalseRes = await text.execute({ data: { operation: 'contains',   input: 'Hello World', search: 'xyz'   } }, ctx);
  check(containsTrueRes.data  === true,  'Contains: true when substring present');
  check(containsFalseRes.data === false, 'Contains: false when substring absent');

  const swTrueRes  = await text.execute({ data: { operation: 'startsWith', input: 'Hello World', search: 'Hello' } }, ctx);
  const swFalseRes = await text.execute({ data: { operation: 'startsWith', input: 'Hello World', search: 'World' } }, ctx);
  check(swTrueRes.data  === true,  'Starts With: true when matches');
  check(swFalseRes.data === false, 'Starts With: false when does not match');

  const ewTrueRes  = await text.execute({ data: { operation: 'endsWith', input: 'Hello World', search: 'World' } }, ctx);
  const ewFalseRes = await text.execute({ data: { operation: 'endsWith', input: 'Hello World', search: 'Hello' } }, ctx);
  check(ewTrueRes.data  === true,  'Ends With: true when matches');
  check(ewFalseRes.data === false, 'Ends With: false when does not match');

  // ── Group 5: Split ──────────────────────────────────────────────────────────
  console.log('\nGroup 5: Split');

  const splitRes = await text.execute({ data: { operation: 'split', input: 'a,b,c', separator: ',' } }, ctx);
  check(Array.isArray(splitRes.data), 'Split: returns array');
  check(splitRes.data.length === 3, 'Split: correct element count');
  check(splitRes.data[0] === 'a' && splitRes.data[2] === 'c', 'Split: correct elements');

  const splitSpaceRes = await text.execute({ data: { operation: 'split', input: 'hello world', separator: ' ' } }, ctx);
  check(splitSpaceRes.data.length === 2, 'Split by space: two elements');

  // ── Group 6: Join ───────────────────────────────────────────────────────────
  console.log('\nGroup 6: Join');

  // Join requires input — pass the join result using lastOutput as effective input via empty string BUT
  // validate requires non-empty input. We need to pass input field or the array directly.
  // The node uses effectiveInput which falls back to lastOutput if input resolves to empty.
  // However validate still checks the `input` field for emptiness. We need input to be non-empty.
  // Solution: Pass a variable expression as input — {{prev}} which resolves to the lastOutput array.
  // But validate checks the raw field value not the resolved. So we must pass a non-empty input.
  // Let's pass the array JSON-serialized string or a valid variable reference string.
  const joinCtx2 = new ExecutionContext();
  joinCtx2.lastOutput = ['X', 'Y', 'Z'];
  // Pass {{prev}} as input — it's non-empty and resolves to the lastOutput array
  const joinDirect = await text.execute({ data: { operation: 'join', input: '{{prev}}', separator: '/' } }, joinCtx2);
  // {{prev}} resolves to ['X','Y','Z'] via VariableResolver
  // If it doesn't resolve cleanly, fallback to lastOutput
  check(typeof joinDirect.data === 'string', 'Join: returns a string');
  check(joinDirect.data.includes('X') && joinDirect.data.includes('Z'), 'Join: array elements appear in result');

  // ── Group 7: Length ─────────────────────────────────────────────────────────
  console.log('\nGroup 7: Length');

  const lenStrRes = await text.execute({ data: { operation: 'length', input: 'hello' } }, ctx);
  check(lenStrRes.data === 5, 'Length: correct string length');

  const lenCtx = new ExecutionContext();
  lenCtx.lastOutput = [1, 2, 3, 4];
  const lenArrRes = await text.execute({ data: { operation: 'length', input: '{{prev}}' } }, lenCtx);
  check(lenArrRes.data === 4, 'Length: correct array length from lastOutput via {{prev}}');

  // ── Group 8: Substring ───────────────────────────────────────────────────────
  console.log('\nGroup 8: Substring');

  const subFullRes = await text.execute({ data: { operation: 'substring', input: 'Hello World', start: '0', end: '5' } }, ctx);
  check(subFullRes.data === 'Hello', 'Substring: [0,5] returns "Hello"');

  const subNoEndRes = await text.execute({ data: { operation: 'substring', input: 'Hello World', start: '6' } }, ctx);
  check(subNoEndRes.data === 'World', 'Substring: no end returns from start to end of string');

  const subMidRes = await text.execute({ data: { operation: 'substring', input: 'abcdef', start: '2', end: '4' } }, ctx);
  check(subMidRes.data === 'cd', 'Substring: [2,4] returns "cd"');

  // ── Group 9: Validation ─────────────────────────────────────────────────────
  console.log('\nGroup 9: Validation');

  check(text.validate({ data: {} }).valid === false, 'Rejects missing operation');
  check(text.validate({ data: { operation: 'superconvert' } }).valid === false, 'Rejects unsupported operation');
  check(text.validate({ data: { operation: 'uppercase', input: '' } }).valid === false, 'Rejects uppercase with empty input');
  check(text.validate({ data: { operation: 'replace',   input: 'x', find: '' } }).valid === false, 'Rejects replace with no find value');
  check(text.validate({ data: { operation: 'uppercase', input: 'hello' } }).valid === true, 'Accepts valid uppercase config');
  check(text.validate({ data: { operation: 'split', input: 'a,b', separator: ',' } }).valid === true, 'Accepts valid split config');

  // ── Group 10: Empty Input Error ─────────────────────────────────────────────
  console.log('\nGroup 10: Empty Input Errors');

  const emptyUpperErr = await text.execute({ data: { operation: 'uppercase', input: '' } }, { lastOutput: null }).catch((e) => ({ _error: e.message }));
  // When effectiveInput is null/empty — actually '' resolves fine. The error comes from validate if called first.
  // The node itself will NOT error on empty string from execute since '' is a valid string for uppercase.
  // The validate() catches it before execute. So let's test via validate route:
  const emptyValidation = text.validate({ data: { operation: 'uppercase', input: '' } });
  check(emptyValidation.valid === false, 'Validate catches empty input for uppercase');

  // ── Report ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) { console.error('❌ SOME TEXT NODE TESTS FAILED\n'); process.exit(1); }
  else              console.log('🎉 ALL TEXT NODE TESTS PASSED!\n\n');
}

runTests().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });

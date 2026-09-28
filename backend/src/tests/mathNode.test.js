/**
 * MathNode Backend Unit Tests
 * Covers: all 12 operations, division by zero, invalid number, validation
 */

const assert = require('assert');
const MathNode = require('../nodes/MathNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function runTests() {
  console.log('\n🧪 Starting MathNode Unit Tests...\n');
  const math = new MathNode();
  const ctx  = new ExecutionContext();

  // Helper: shortcut executor
  const run = (operation, valueA, valueB) =>
    math.execute({ data: { operation, valueA: String(valueA), valueB: valueB !== undefined ? String(valueB) : undefined } }, ctx);

  // ── Group 1: Arithmetic ─────────────────────────────────────────────────────
  console.log('Group 1: Arithmetic Operations');

  const addRes = await run('add', 10, 5);
  check(addRes.data === 15, 'Add: 10 + 5 = 15');
  check(addRes.operation === 'add', 'Add: operation field set');

  const subRes = await run('subtract', 10, 3);
  check(subRes.data === 7, 'Subtract: 10 - 3 = 7');

  const mulRes = await run('multiply', 4, 7);
  check(mulRes.data === 28, 'Multiply: 4 × 7 = 28');

  const divRes = await run('divide', 20, 4);
  check(divRes.data === 5, 'Divide: 20 ÷ 4 = 5');

  const modRes = await run('modulo', 10, 3);
  check(modRes.data === 1, 'Modulo: 10 % 3 = 1');

  // ── Group 2: Rounding ───────────────────────────────────────────────────────
  console.log('\nGroup 2: Rounding Operations');

  const roundUpRes   = await run('round', 4.6);
  const roundDownRes = await run('round', 4.4);
  check(roundUpRes.data   === 5, 'Round: 4.6 → 5');
  check(roundDownRes.data === 4, 'Round: 4.4 → 4');

  const floorRes = await run('floor', 4.9);
  check(floorRes.data === 4, 'Floor: 4.9 → 4');

  const ceilRes = await run('ceil', 4.1);
  check(ceilRes.data === 5, 'Ceil: 4.1 → 5');

  const absNegRes = await run('absolute', -15);
  const absPosRes = await run('absolute', 15);
  check(absNegRes.data === 15, 'Absolute: -15 → 15');
  check(absPosRes.data === 15, 'Absolute: 15 → 15');

  // ── Group 3: Min / Max ──────────────────────────────────────────────────────
  console.log('\nGroup 3: Min / Max');

  const minRes = await run('min', 3, 8);
  check(minRes.data === 3, 'Min: min(3, 8) = 3');

  const maxRes = await run('max', 3, 8);
  check(maxRes.data === 8, 'Max: max(3, 8) = 8');

  const minNegRes = await run('min', -5, 5);
  check(minNegRes.data === -5, 'Min: min(-5, 5) = -5');

  // ── Group 4: Percentage ─────────────────────────────────────────────────────
  console.log('\nGroup 4: Percentage');

  const pctRes = await run('percentage', 75, 100);
  check(pctRes.data === 75, 'Percentage: (75/100)*100 = 75%');

  const pctPartialRes = await run('percentage', 1, 3);
  check(Math.abs(pctPartialRes.data - 33.333333333333336) < 1e-9, 'Percentage: (1/3)*100 ≈ 33.33%');

  // ── Group 5: Variable Resolution ────────────────────────────────────────────
  console.log('\nGroup 5: Variable Resolution');

  const varCtx = new ExecutionContext();
  varCtx.setResult('calc', { price: 250, qty: 3 });
  varCtx.lastOutput = { price: 250, qty: 3 };

  const varMulRes = await math.execute({
    data: { operation: 'multiply', valueA: '{{prev.price}}', valueB: '{{prev.qty}}' },
  }, varCtx);
  check(varMulRes.data === 750, 'Variable resolution: {{prev.price}} × {{prev.qty}} = 750');

  // ── Group 6: Division by Zero ─────────────────────────────────────────────
  console.log('\nGroup 6: Division by Zero');

  const divZeroErr = await run('divide', 10, 0).catch((e) => ({ _error: e.message }));
  check(divZeroErr._error && divZeroErr._error.includes('division by zero'), 'Divide by zero throws clear error');

  const modZeroErr = await run('modulo', 5, 0).catch((e) => ({ _error: e.message }));
  check(modZeroErr._error && modZeroErr._error.includes('modulo by zero'), 'Modulo by zero throws clear error');

  const pctZeroErr = await run('percentage', 50, 0).catch((e) => ({ _error: e.message }));
  check(pctZeroErr._error && pctZeroErr._error.includes('cannot be zero'), 'Percentage denominator zero throws clear error');

  // ── Group 7: Invalid Number Validation ──────────────────────────────────────
  console.log('\nGroup 7: Invalid Number Validation');

  const invalidAErr = await math.execute({ data: { operation: 'add', valueA: 'not-a-number', valueB: '5' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(invalidAErr._error && invalidAErr._error.includes('not a valid number'), 'Rejects non-numeric Value A');

  const invalidBErr = await math.execute({ data: { operation: 'add', valueA: '5', valueB: 'abc' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(invalidBErr._error && invalidBErr._error.includes('not a valid number'), 'Rejects non-numeric Value B');

  // NaN: NaN-returning computation
  const nanAErr = await math.execute({ data: { operation: 'add', valueA: 'NaN', valueB: '5' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(nanAErr._error, 'Rejects NaN input (not finite number)');

  // ── Group 8: Validation Rules ────────────────────────────────────────────────
  console.log('\nGroup 8: Validation Rules');

  check(math.validate({ data: {} }).valid === false, 'Rejects missing operation');
  check(math.validate({ data: { operation: 'superpower' } }).valid === false, 'Rejects unsupported operation');
  check(math.validate({ data: { operation: 'add', valueA: '' } }).valid === false, 'Rejects add with empty Value A');
  check(math.validate({ data: { operation: 'multiply', valueA: '10', valueB: '' } }).valid === false, 'Rejects multiply with empty Value B');
  check(math.validate({ data: { operation: 'round', valueA: '5.5' } }).valid === true, 'Accepts round (unary) with only Value A');
  check(math.validate({ data: { operation: 'add', valueA: '10', valueB: '5' } }).valid === true, 'Accepts valid add config');

  // ── Report ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) { console.error('❌ SOME MATH NODE TESTS FAILED\n'); process.exit(1); }
  else              console.log('🎉 ALL MATH NODE TESTS PASSED!\n\n');
}

runTests().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });

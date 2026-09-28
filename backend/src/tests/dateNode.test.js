/**
 * DateNode Backend Unit Tests
 * Covers: now, parse, format, add, subtract, compare, difference,
 *         invalid date, invalid amount/unit, validation
 */

const assert = require('assert');
const DateNode = require('../nodes/DateNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function runTests() {
  console.log('\n🧪 Starting DateNode Unit Tests...\n');
  const date = new DateNode();
  const ctx  = new ExecutionContext();

  // ── Group 1: Now ────────────────────────────────────────────────────────────
  console.log('Group 1: Now');

  const nowRes = await date.execute({ data: { operation: 'now' } }, ctx);
  check(typeof nowRes.data === 'string', 'Now: returns a string');
  check(!isNaN(new Date(nowRes.data).getTime()), 'Now: returns a valid parseable ISO date');
  check(nowRes.data.endsWith('Z'), 'Now: returns UTC ISO-8601 (ends with Z)');
  check(nowRes.operation === 'now', 'Now: operation field set');

  // ── Group 2: Parse ──────────────────────────────────────────────────────────
  console.log('\nGroup 2: Parse');

  const parseRes = await date.execute({ data: { operation: 'parse', dateInput: '2024-06-15T12:00:00Z' } }, ctx);
  check(parseRes.data === '2024-06-15T12:00:00.000Z', 'Parse: ISO string round-trips correctly');
  check(typeof parseRes.data === 'string', 'Parse: returns string');

  const parseOffsetRes = await date.execute({ data: { operation: 'parse', dateInput: '2024-01-01T05:30:00+05:30' } }, ctx);
  check(!isNaN(new Date(parseOffsetRes.data).getTime()), 'Parse: handles timezone offset correctly');

  // ── Group 3: Format ─────────────────────────────────────────────────────────
  console.log('\nGroup 3: Format');

  const fmtRes = await date.execute({ data: { operation: 'format', dateInput: '2024-06-15T12:30:45Z', dateFormat: 'YYYY-MM-DD' } }, ctx);
  check(fmtRes.data === '2024-06-15', 'Format: YYYY-MM-DD pattern works');

  const fmtFullRes = await date.execute({ data: { operation: 'format', dateInput: '2024-06-15T12:30:45Z', dateFormat: 'YYYY-MM-DD HH:mm:ss' } }, ctx);
  check(fmtFullRes.data === '2024-06-15 12:30:45', 'Format: YYYY-MM-DD HH:mm:ss pattern works');

  const fmtIsoRes = await date.execute({ data: { operation: 'format', dateInput: '2024-06-15T00:00:00Z', dateFormat: '' } }, ctx);
  check(!isNaN(new Date(fmtIsoRes.data).getTime()), 'Format: empty format falls back to ISO string');

  // ── Group 4: Add ────────────────────────────────────────────────────────────
  console.log('\nGroup 4: Add Time');

  const addDaysRes = await date.execute({ data: { operation: 'add', dateInput: '2024-01-01T00:00:00Z', amount: '7', unit: 'days' } }, ctx);
  const addedDate  = new Date(addDaysRes.data);
  check(addedDate.getUTCDate() === 8, 'Add 7 days: date incremented correctly');
  check(addedDate.getUTCMonth() === 0, 'Add 7 days: month unchanged');

  const addHoursRes = await date.execute({ data: { operation: 'add', dateInput: '2024-01-01T00:00:00Z', amount: '3', unit: 'hours' } }, ctx);
  check(new Date(addHoursRes.data).getUTCHours() === 3, 'Add 3 hours: hours incremented');

  const addMonthsRes = await date.execute({ data: { operation: 'add', dateInput: '2024-01-15T00:00:00Z', amount: '1', unit: 'months' } }, ctx);
  check(new Date(addMonthsRes.data).getUTCMonth() === 1, 'Add 1 month: month incremented (Jan→Feb)');

  const addYearsRes = await date.execute({ data: { operation: 'add', dateInput: '2024-01-01T00:00:00Z', amount: '2', unit: 'years' } }, ctx);
  check(new Date(addYearsRes.data).getUTCFullYear() === 2026, 'Add 2 years: year incremented');

  // ── Group 5: Subtract ───────────────────────────────────────────────────────
  console.log('\nGroup 5: Subtract Time');

  const subDaysRes = await date.execute({ data: { operation: 'subtract', dateInput: '2024-01-10T00:00:00Z', amount: '5', unit: 'days' } }, ctx);
  check(new Date(subDaysRes.data).getUTCDate() === 5, 'Subtract 5 days: date decremented');

  const subWeeksRes = await date.execute({ data: { operation: 'subtract', dateInput: '2024-01-15T00:00:00Z', amount: '2', unit: 'weeks' } }, ctx);
  check(new Date(subWeeksRes.data).getUTCDate() === 1, 'Subtract 2 weeks: date decremented by 14 days');

  // ── Group 6: Compare ─────────────────────────────────────────────────────────
  console.log('\nGroup 6: Compare');

  const cmpBeforeRes = await date.execute({
    data: { operation: 'compare', dateA: '2023-01-01T00:00:00Z', dateB: '2024-01-01T00:00:00Z' },
  }, ctx);
  check(cmpBeforeRes.data === 'before', 'Compare: 2023 before 2024 → "before"');

  const cmpAfterRes = await date.execute({
    data: { operation: 'compare', dateA: '2025-01-01T00:00:00Z', dateB: '2024-01-01T00:00:00Z' },
  }, ctx);
  check(cmpAfterRes.data === 'after', 'Compare: 2025 after 2024 → "after"');

  const cmpEqualRes = await date.execute({
    data: { operation: 'compare', dateA: '2024-06-15T00:00:00.000Z', dateB: '2024-06-15T00:00:00.000Z' },
  }, ctx);
  check(cmpEqualRes.data === 'equal', 'Compare: same date → "equal"');

  // ── Group 7: Difference ──────────────────────────────────────────────────────
  console.log('\nGroup 7: Difference');

  const diffDaysRes = await date.execute({
    data: { operation: 'difference', dateA: '2024-01-11T00:00:00Z', dateB: '2024-01-01T00:00:00Z', outputUnit: 'days' },
  }, ctx);
  check(diffDaysRes.data === 10, 'Difference in days: 10 days apart');

  const diffHoursRes = await date.execute({
    data: { operation: 'difference', dateA: '2024-01-02T06:00:00Z', dateB: '2024-01-01T00:00:00Z', outputUnit: 'hours' },
  }, ctx);
  check(diffHoursRes.data === 30, 'Difference in hours: 30 hours apart');

  const diffMsRes = await date.execute({
    data: { operation: 'difference', dateA: '2024-01-01T00:00:01Z', dateB: '2024-01-01T00:00:00Z', outputUnit: 'milliseconds' },
  }, ctx);
  check(diffMsRes.data === 1000, 'Difference in ms: 1000ms apart');

  // ── Group 8: Variable Resolution ─────────────────────────────────────────────
  console.log('\nGroup 8: Variable Resolution');

  const varCtx = new ExecutionContext();
  varCtx.lastOutput = { createdAt: '2024-03-01T00:00:00Z', daysToAdd: '10' };
  const varAddRes = await date.execute({
    data: { operation: 'add', dateInput: '{{prev.createdAt}}', amount: '{{prev.daysToAdd}}', unit: 'days' },
  }, varCtx);
  check(!isNaN(new Date(varAddRes.data).getTime()), 'Variable: resolves {{prev.createdAt}} for date add');
  check(new Date(varAddRes.data).getUTCDate() === 11, 'Variable: adds {{prev.daysToAdd}} days correctly');

  // ── Group 9: Invalid Date ─────────────────────────────────────────────────────
  console.log('\nGroup 9: Invalid Date');

  const invalidParseErr = await date.execute({ data: { operation: 'parse', dateInput: 'not-a-date' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(invalidParseErr._error && invalidParseErr._error.includes('not a valid date'), 'Parse rejects invalid date string');

  const invalidAddErr = await date.execute({ data: { operation: 'add', dateInput: 'bad-date', amount: '1', unit: 'days' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(invalidAddErr._error && invalidAddErr._error.includes('not a valid date'), 'Add rejects invalid date input');

  const invalidAmountErr = await date.execute({ data: { operation: 'add', dateInput: '2024-01-01T00:00:00Z', amount: 'xyz', unit: 'days' } }, ctx)
    .catch((e) => ({ _error: e.message }));
  check(invalidAmountErr._error && invalidAmountErr._error.includes('is not a valid number'), 'Add rejects invalid amount');

  // ── Group 10: Validation ─────────────────────────────────────────────────────
  console.log('\nGroup 10: Validation');

  check(date.validate({ data: {} }).valid === false, 'Rejects missing operation');
  check(date.validate({ data: { operation: 'timetravel' } }).valid === false, 'Rejects unsupported operation');
  check(date.validate({ data: { operation: 'parse', dateInput: '' } }).valid === false, 'Rejects parse with empty dateInput');
  check(date.validate({ data: { operation: 'add', dateInput: '2024-01-01', amount: '', unit: 'days' } }).valid === false, 'Rejects add with empty amount');
  check(date.validate({ data: { operation: 'compare', dateA: '2024-01-01', dateB: '' } }).valid === false, 'Rejects compare with missing dateB');
  check(date.validate({ data: { operation: 'difference', dateA: '2024-01-01', dateB: '2023-01-01', outputUnit: '' } }).valid === false, 'Rejects difference with invalid outputUnit');
  check(date.validate({ data: { operation: 'now' } }).valid === true, 'Accepts now (no inputs required)');
  check(date.validate({ data: { operation: 'add', dateInput: '2024-01-01', amount: '5', unit: 'days' } }).valid === true, 'Accepts valid add config');

  // ── Report ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} tests — ${passed} passed, ${failed} failed\n`);
  if (failed > 0) { console.error('❌ SOME DATE NODE TESTS FAILED\n'); process.exit(1); }
  else              console.log('🎉 ALL DATE NODE TESTS PASSED!\n\n');
}

runTests().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });

/**
 * SMTP Provider Unit Tests
 *
 * Tests core SMTPProvider and EmailNode behaviours without making real network calls.
 * All transport operations are overridden at the class level.
 */

const SMTPProvider = require('../providers/mail/SMTPProvider');
const MailProvider = require('../providers/mail/MailProvider');
const NodeExecutionError = require('../errors/NodeExecutionError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function assertThrows(fn, expectedMessage, label) {
  try {
    await fn();
    console.error(`  ❌ FAIL: ${label} — expected an error but none was thrown`);
    failed++;
  } catch (err) {
    if (err.message && err.message.includes(expectedMessage)) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label} — wrong error: "${err.message}"`);
      failed++;
    }
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 Starting SMTP Provider Unit Tests...\n');

  // ── Test 1: MailProvider base class enforces interface ─────────────────────
  console.log('Group 1: Abstract MailProvider interface');

  const base = new MailProvider();
  await assertThrows(
    () => base.send({}),
    'must implement send()',
    'MailProvider.send() throws NotImplemented'
  );
  await assertThrows(
    () => base.verifyConnection(),
    'must implement verifyConnection()',
    'MailProvider.verifyConnection() throws NotImplemented'
  );

  // ── Test 2: Missing configuration ──────────────────────────────────────────
  console.log('\nGroup 2: Missing SMTP configuration');

  const savedEnv = { ...process.env };
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;

  const unconfigured = new SMTPProvider();
  assert(!unconfigured.isConfigured(), 'isConfigured() returns false when env vars are missing');

  await assertThrows(
    () => unconfigured.send({ to: 'test@example.com', subject: 'Hi', text: 'Hello' }),
    'SMTP is not configured',
    'send() throws NodeExecutionError when unconfigured'
  );

  const verifyResult = await unconfigured.verifyConnection();
  assert(verifyResult.ok === false, 'verifyConnection() returns { ok: false } when unconfigured');
  assert(
    verifyResult.message.includes('not configured'),
    'verifyConnection() message explains missing config'
  );

  // ── Test 3: Valid configuration detected ───────────────────────────────────
  console.log('\nGroup 3: Valid SMTP configuration');

  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASSWORD = 'secret';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';

  const configured = new SMTPProvider();
  assert(configured.isConfigured(), 'isConfigured() returns true when env vars are set');

  // ── Test 4: Authentication failure mapping ─────────────────────────────────
  console.log('\nGroup 4: SMTP error message mapping');

  const authError = Object.assign(new Error('Invalid login'), { code: 'EAUTH' });
  const authMsg = SMTPProvider._describeError(authError);
  assert(authMsg.includes('authentication failed'), '_describeError maps EAUTH to readable message');

  const connError = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
  const connMsg = SMTPProvider._describeError(connError);
  assert(connMsg.includes('connection refused'), '_describeError maps ECONNREFUSED to readable message');

  const timeoutError = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
  const timeoutMsg = SMTPProvider._describeError(timeoutError);
  assert(timeoutMsg.includes('timed out'), '_describeError maps ETIMEDOUT to readable message');

  const recipientError = Object.assign(new Error('User unknown'), { code: 'EENVELOPE', responseCode: 550 });
  const recipientMsg = SMTPProvider._describeError(recipientError);
  assert(
    recipientMsg.includes('Recipient rejected') || recipientMsg.includes('Invalid envelope'),
    '_describeError maps 550 recipient rejection to readable message'
  );

  // ── Test 5: Simulated successful delivery ──────────────────────────────────
  console.log('\nGroup 5: Simulated SMTP delivery');

  const successProvider = new SMTPProvider();
  successProvider._getTransporter = () => ({
    sendMail: async () => ({
      accepted: ['recipient@example.com'],
      rejected: [],
      messageId: '<test-message-id@example.com>',
      response: '250 OK',
      envelope: { from: 'sender@example.com', to: ['recipient@example.com'] },
    }),
  });

  const deliveryResult = await successProvider.send({
    to: 'recipient@example.com',
    subject: 'Test Email',
    text: 'Hello World',
  });

  assert(deliveryResult.delivered === true, 'Successful delivery sets delivered=true');
  assert(deliveryResult.accepted.includes('recipient@example.com'), 'accepted[] contains recipient');
  assert(deliveryResult.provider === 'smtp', 'provider is "smtp"');
  assert(typeof deliveryResult.messageId === 'string', 'messageId is populated');
  assert(typeof deliveryResult.sentAt === 'string', 'sentAt timestamp is populated');

  // ── Test 6: Simulated delivery failure surfaces as NodeExecutionError ───────
  console.log('\nGroup 6: Failed delivery throws NodeExecutionError');

  const failProvider = new SMTPProvider();
  failProvider._getTransporter = () => ({
    sendMail: async () => {
      const err = new Error('Invalid login: 535');
      err.code = 'EAUTH';
      throw err;
    },
  });

  await assertThrows(
    () => failProvider.send({ to: 'x@example.com', subject: 'Fail', text: 'test' }),
    'authentication failed',
    'EAUTH delivery error surfaced as NodeExecutionError with readable message'
  );

  // ── Test 7: verifyConnection with mock success ─────────────────────────────
  console.log('\nGroup 7: verifyConnection simulation');

  const verifyProvider = new SMTPProvider();
  verifyProvider._getTransporter = () => ({
    verify: async () => true,
  });

  const verifyOk = await verifyProvider.verifyConnection();
  assert(verifyOk.ok === true, 'verifyConnection() returns { ok: true } on success');
  assert(verifyOk.message.includes('connected'), 'verifyConnection() success message includes "connected"');

  // ── Restore environment ────────────────────────────────────────────────────
  Object.keys(process.env).forEach((k) => {
    if (k.startsWith('SMTP_')) delete process.env[k];
  });
  Object.assign(process.env, savedEnv);

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME SMTP TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SMTP PROVIDER TESTS PASSED!\n');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

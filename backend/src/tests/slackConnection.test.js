/**
 * Slack Connection Unit Tests
 * Covers:
 *   - Provider registration in ConnectionRegistry
 *   - Metadata, icons, required fields
 *   - Verification with valid, invalid, empty token, and network error
 *   - Credential encryption, decryption, and secret redaction
 */

const assert = require('assert');
const { connectionRegistry } = require('../providers/connections/ConnectionRegistry');
const SlackConnectionProvider = require('../providers/connections/SlackConnectionProvider');
const CredentialService = require('../services/CredentialService');
const { redactSecrets } = require('../utils/SecretRedactor');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Slack Connection Unit Tests...\n');

  // ── 1. Provider Registration ──────────────────────────────────────────────
  console.log('Test Group 1: Provider Registration');

  const provider = connectionRegistry.resolve('slack');
  check(Boolean(provider), 'ConnectionRegistry: slack provider is registered');
  check(provider.id === 'slack', 'ConnectionRegistry: provider ID is slack');
  check(provider.name === 'Slack', 'ConnectionRegistry: provider name is Slack');
  check(provider.category === 'chat', 'ConnectionRegistry: provider category is chat');
  check(provider.supportsVerification === true, 'ConnectionRegistry: supportsVerification is true');
  check(Array.isArray(provider.requiredFields), 'ConnectionRegistry: requiredFields is an array');

  const tokenField = provider.requiredFields.find((f) => f.key === 'token');
  check(Boolean(tokenField), 'ConnectionRegistry: requiredFields contains "token" field');
  check(tokenField.required === true, 'ConnectionRegistry: token field is required');
  check(tokenField.type === 'password', 'ConnectionRegistry: token field is password type');

  // Check instance
  const slackInstance = new SlackConnectionProvider();
  check(typeof slackInstance.verifyCredentials === 'function', 'SlackConnectionProvider: has verifyCredentials');
  check(typeof slackInstance.verify === 'function', 'SlackConnectionProvider: has verify');
  check(typeof slackInstance.disconnect === 'function', 'SlackConnectionProvider: has disconnect');

  // ── 2. Verification Logic ─────────────────────────────────────────────────
  console.log('\nTest Group 2: Verification Logic');

  // Empty / missing token
  const emptyRes = await slackInstance.verify({});
  check(emptyRes.ok === false, 'SlackConnectionProvider: rejects empty credentials');
  check(emptyRes.message.includes('required'), 'SlackConnectionProvider: error message mentions required');

  // Invalid token format
  const badFormatRes = await slackInstance.verify({ token: 'invalid-token-without-prefix' });
  check(badFormatRes.ok === false, 'SlackConnectionProvider: rejects token not starting with xoxb- or xoxp-');
  check(badFormatRes.message.includes('xoxb-'), 'SlackConnectionProvider: error explains expected token prefix');

  // Successful verification (mocked)
  const mockSuccessRes = await slackInstance.verify({
    token: 'xoxb-valid-test-bot-token-12345',
    _mockAuthResult: {
      ok: true,
      team: 'Acme Corp',
      user: 'logicbridge_bot',
      bot_id: 'B0123456789',
    },
  });
  check(mockSuccessRes.ok === true, 'SlackConnectionProvider: verifies valid bot token');
  check(mockSuccessRes.team === 'Acme Corp', 'SlackConnectionProvider: returns team metadata');
  check(mockSuccessRes.user === 'logicbridge_bot', 'SlackConnectionProvider: returns user metadata');
  check(mockSuccessRes.bot_id === 'B0123456789', 'SlackConnectionProvider: returns bot_id metadata');

  // Failed verification from Slack API (mocked)
  const mockFailRes = await slackInstance.verify({
    token: 'xoxb-revoked-token',
    _mockAuthResult: {
      ok: false,
      error: 'invalid_auth',
    },
  });
  check(mockFailRes.ok === false, 'SlackConnectionProvider: handles Slack API auth failure');
  check(mockFailRes.message.includes('invalid_auth'), 'SlackConnectionProvider: preserves error reason');

  // Network / server exception
  const mockErrorRes = await slackInstance.verify({
    token: 'xoxb-error-trigger',
    _mockAuthResult: new Error('Slack API timeout'),
  });
  check(mockErrorRes.ok === false, 'SlackConnectionProvider: handles network failure gracefully');
  check(mockErrorRes.message.includes('Slack API timeout'), 'SlackConnectionProvider: returns clean error message');

  // ── 3. Credential Encryption & Redaction ──────────────────────────────────
  console.log('\nTest Group 3: Credential Encryption & Secret Redaction');

  const rawSecret = 'xoxb-mock-bot-token-test-secret-fixture';
  const encrypted = CredentialService.encrypt(rawSecret);
  check(encrypted !== rawSecret, 'CredentialService: encrypts Slack token');
  check(typeof encrypted === 'string' && encrypted.length > 20, 'CredentialService: encrypted payload is a valid string');

  const decrypted = CredentialService.decrypt(encrypted);
  check(decrypted === rawSecret, 'CredentialService: decrypts Slack token correctly');

  // Redaction testing
  const logMessage = `Connecting to Slack with token xoxb-mock-bot-token-test-redaction and webhook https://hooks.slack.com/services/TEST00000/TEST00000/mock-fake-webhook-token-sample`;
  const redacted = redactSecrets(logMessage);
  check(!redacted.includes('xoxb-mock-bot-token-test-redaction'), 'SecretRedactor: masks xoxb- bot token in strings');
  check(!redacted.includes('mock-fake-webhook-token-sample'), 'SecretRedactor: masks Slack webhook secret path');
  check(redacted.includes('[REDACTED]'), 'SecretRedactor: inserts [REDACTED] placeholder');

  // Redacting nested credential object
  const credentialObj = {
    team: 'Engineering',
    token: 'xoxb-mock-token-sample',
    botToken: 'xoxb-mock-bot-sample',
    slackToken: 'xoxp-mock-user-sample',
  };
  const redactedObj = redactSecrets(credentialObj);
  check(redactedObj.token === '[REDACTED]', 'SecretRedactor: redacts token key in object');
  check(redactedObj.botToken === '[REDACTED]', 'SecretRedactor: redacts botToken key in object');
  check(redactedObj.slackToken === '[REDACTED]', 'SecretRedactor: redacts slackToken key in object');
  check(redactedObj.team === 'Engineering', 'SecretRedactor: preserves non-sensitive fields');

  console.log(`\nSlack Connection Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});


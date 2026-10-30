/**
 * Discord Connection Unit Tests
 * Covers:
 *   - Provider registration in ConnectionRegistry
 *   - Bot Token and Webhook connection types
 *   - Verification with valid, invalid, and empty tokens/webhooks
 *   - Credential encryption, decryption, and secret redaction
 */

const assert = require('assert');
const { connectionRegistry } = require('../providers/connections/ConnectionRegistry');
const DiscordConnectionProvider = require('../providers/connections/DiscordConnectionProvider');
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
  console.log('\n🧪 Starting Discord Connection Unit Tests...\n');

  // ── 1. Provider Registration ──────────────────────────────────────────────
  console.log('Test Group 1: Provider Registration');

  const provider = connectionRegistry.resolve('discord');
  check(Boolean(provider), 'ConnectionRegistry: discord provider is registered');
  check(provider.id === 'discord', 'ConnectionRegistry: provider ID is discord');
  check(provider.name === 'Discord', 'ConnectionRegistry: provider name is Discord');
  check(provider.category === 'chat', 'ConnectionRegistry: provider category is chat');
  check(provider.supportsVerification === true, 'ConnectionRegistry: supportsVerification is true');
  check(Array.isArray(provider.requiredFields), 'ConnectionRegistry: requiredFields is an array');

  const authTypeField = provider.requiredFields.find((f) => f.key === 'authType');
  check(Boolean(authTypeField), 'ConnectionRegistry: requiredFields contains authType select field');
  check(Array.isArray(authTypeField.options), 'ConnectionRegistry: authType field has options array');
  check(authTypeField.options.includes('bot_token') && authTypeField.options.includes('webhook'), 'ConnectionRegistry: options include bot_token and webhook');

  // Instance check
  const discordInstance = new DiscordConnectionProvider();
  check(typeof discordInstance.verifyCredentials === 'function', 'DiscordConnectionProvider: has verifyCredentials');
  check(typeof discordInstance.verify === 'function', 'DiscordConnectionProvider: has verify');
  check(typeof discordInstance.disconnect === 'function', 'DiscordConnectionProvider: has disconnect');

  // ── 2. Verification Logic: Webhook ─────────────────────────────────────────
  console.log('\nTest Group 2: Webhook Verification');

  // Missing webhook URL
  const emptyWebhook = await discordInstance.verify({ authType: 'webhook', webhookUrl: '' });
  check(emptyWebhook.ok === false, 'DiscordConnectionProvider: rejects empty webhook URL');

  // Invalid webhook format
  const badWebhook = await discordInstance.verify({ authType: 'webhook', webhookUrl: 'https://example.com/not-discord' });
  check(badWebhook.ok === false, 'DiscordConnectionProvider: rejects non-Discord webhook URL format');
  check(badWebhook.message.includes('https://discord.com/api/webhooks/'), 'DiscordConnectionProvider: error informs required URL prefix');

  // Webhook verification via mock HTTP client
  const mockWebhookClient = async () => ({
    data: {
      id: '123456789012345678',
      name: 'AlertsBot',
      channel_id: '987654321098765432',
      guild_id: '112233445566778899',
    },
  });

  const validWebhookRes = await discordInstance.verify({
    authType: 'webhook',
    webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/mock-token-abc',
    _axiosClient: mockWebhookClient,
  });
  check(validWebhookRes.ok === true, 'DiscordConnectionProvider: verifies valid Discord webhook');
  check(validWebhookRes.webhookName === 'AlertsBot', 'DiscordConnectionProvider: extracts webhook name');
  check(validWebhookRes.channelId === '987654321098765432', 'DiscordConnectionProvider: extracts channel ID');

  // Webhook 404/401 failure via mock client
  const failingWebhookClient = async () => {
    const error = new Error('Request failed with status code 404');
    error.response = { status: 404, data: { message: 'Unknown Webhook' } };
    throw error;
  };
  const failWebhookRes = await discordInstance.verify({
    authType: 'webhook',
    webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/revoked-token',
    _axiosClient: failingWebhookClient,
  });
  check(failWebhookRes.ok === false, 'DiscordConnectionProvider: handles 404/revoked webhook');
  check(failWebhookRes.message.includes('Webhook not found or token revoked'), 'DiscordConnectionProvider: clean message for revoked webhook');

  // ── 3. Verification Logic: Bot Token ───────────────────────────────────────
  console.log('\nTest Group 3: Bot Token Verification');

  // Missing bot token
  const emptyBot = await discordInstance.verify({ authType: 'bot_token', botToken: '' });
  check(emptyBot.ok === false, 'DiscordConnectionProvider: rejects missing bot token');

  // Bot verification via mock HTTP client
  const mockBotClient = async () => ({
    data: {
      id: '123456789012345678',
      username: 'LogicBridgeBot',
      discriminator: '0',
      bot: true,
    },
  });

  const validBotRes = await discordInstance.verify({
    authType: 'bot_token',
    botToken: 'MTAxMjM0NTY3ODkw.MockToken.SecretPart123',
    _axiosClient: mockBotClient,
  });
  check(validBotRes.ok === true, 'DiscordConnectionProvider: verifies valid Discord bot token');
  check(validBotRes.bot === '@LogicBridgeBot', 'DiscordConnectionProvider: extracts bot handle');
  check(validBotRes.userId === '123456789012345678', 'DiscordConnectionProvider: extracts bot user ID');

  // Bot verification 401 unauthorized
  const failingBotClient = async () => {
    const error = new Error('Request failed with status code 401');
    error.response = { status: 401, data: { message: '401: Unauthorized' } };
    throw error;
  };
  const failBotRes = await discordInstance.verify({
    authType: 'bot_token',
    botToken: 'invalid-bot-token',
    _axiosClient: failingBotClient,
  });
  check(failBotRes.ok === false, 'DiscordConnectionProvider: handles 401 unauthorized bot token');
  check(failBotRes.message.includes('Invalid Discord Bot Token'), 'DiscordConnectionProvider: explains invalid token error');

  // Direct mock error
  const directErrorRes = await discordInstance.verify({
    _mockAuthResult: new Error('Discord gateway timeout'),
  });
  check(directErrorRes.ok === false, 'DiscordConnectionProvider: handles network exception via mock');
  check(directErrorRes.message.includes('Discord gateway timeout'), 'DiscordConnectionProvider: includes exception text');

  // ── 4. Encryption & Redaction ─────────────────────────────────────────────
  console.log('\nTest Group 4: Credential Encryption & Secret Redaction');

  const webhookSecret = 'https://discord.com/api/webhooks/123456789012345678/secretTokenAlphaNumericXYZ987';
  const encrypted = CredentialService.encrypt(webhookSecret);
  check(encrypted !== webhookSecret, 'CredentialService: encrypts Discord webhook URL');
  const decrypted = CredentialService.decrypt(encrypted);
  check(decrypted === webhookSecret, 'CredentialService: decrypts Discord webhook URL');

  // Redaction of Discord Webhook URL tokens in logs/errors
  const logWithWebhook = `Posting event to https://discord.com/api/webhooks/123456789012345678/secretTokenAlphaNumericXYZ987 for processing`;
  const redacted = redactSecrets(logWithWebhook);
  check(!redacted.includes('secretTokenAlphaNumericXYZ987'), 'SecretRedactor: masks Discord webhook token in URL string');
  check(redacted.includes('/webhooks/123456789012345678/[REDACTED]'), 'SecretRedactor: preserves webhook ID while redacting token part');

  // Redaction in object
  const credsObj = {
    guildName: 'Dev Server',
    webhookUrl: 'https://discord.com/api/webhooks/111/secret-part',
    botToken: 'MTA...BotSecretToken',
    discordToken: 'token123',
  };
  const redactedObj = redactSecrets(credsObj);
  check(redactedObj.botToken === '[REDACTED]', 'SecretRedactor: redacts botToken field');
  check(redactedObj.discordToken === '[REDACTED]', 'SecretRedactor: redacts discordToken field');
  check(redactedObj.webhookUrl === '[REDACTED]', 'SecretRedactor: redacts webhookUrl field in credential object');
  check(redactedObj.guildName === 'Dev Server', 'SecretRedactor: preserves guildName');

  console.log(`\nDiscord Connection Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});


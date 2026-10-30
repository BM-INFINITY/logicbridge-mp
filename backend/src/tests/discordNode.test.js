/**
 * DiscordNode Unit Tests
 * Covers:
 *   - Node metadata and registration
 *   - Validation rules for all operations
 *   - Operations: send_message, send_embed, send_webhook, get_channel
 *   - Embed color parsing (hex to int) and field resolution
 *   - Dynamic mustache variable resolution in fields and embeds
 *   - Rate limit (HTTP 429) handling and retry backoff
 *   - Error handling and token / webhook secret redaction
 */

const assert = require('assert');
const DiscordNode = require('../nodes/DiscordNode');
const ExecutionContext = require('../utils/ExecutionContext');
const ConnectionService = require('../services/ConnectionService');
const { NodeTypes } = require('../constants');

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
  console.log('\n🧪 Starting DiscordNode Unit Tests...\n');

  const discordNode = new DiscordNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-webhook') {
      return {
        authType: 'webhook',
        webhookUrl: 'https://discord.com/api/webhooks/1234567890/mock-token-abc',
      };
    }
    if (connId === 'conn-bot') {
      return {
        authType: 'bot_token',
        botToken: 'MTAxMjM0NTY3ODkw.MockBotToken.SecretPart123',
      };
    }
    throw new Error('Connection not found');
  };

  try {
    // ── 1. Metadata & Registration ───────────────────────────────────────────
    console.log('Test Group 1: Node Metadata');
    check(discordNode.type === NodeTypes.ACTION_DISCORD, 'DiscordNode: type matches NodeTypes.ACTION_DISCORD');
    check(discordNode.name === 'Discord', 'DiscordNode: name is Discord');
    check(discordNode.category === 'action', 'DiscordNode: category is action');
    check(discordNode.icon === 'MessageCircle', 'DiscordNode: icon is MessageCircle');

    // ── 2. Validation ────────────────────────────────────────────────────────
    console.log('\nTest Group 2: Validation');

    // Missing connection / token / webhook
    const noConn = discordNode.validate({ data: { operation: 'send_message', content: 'Hi' } });
    check(noConn.valid === false && noConn.error.includes('required'), 'DiscordNode: rejects missing connection, token, or webhook');

    // Invalid operation
    const badOp = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'delete_server' } });
    check(badOp.valid === false && badOp.error.includes('Invalid operation'), 'DiscordNode: rejects invalid operation');

    // send_message: missing content
    const noContent = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'send_message', channelId: '123' } });
    check(noContent.valid === false && noContent.error.includes('Message content is required'), 'DiscordNode: rejects send_message without content');

    // send_embed: missing embed / title / description
    const noEmbed = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'send_embed', channelId: '123' } });
    check(noEmbed.valid === false && noEmbed.error.includes('Embed data or title/description is required'), 'DiscordNode: rejects send_embed without embed content');

    // send_webhook: missing webhook and connection
    const noHook = discordNode.validate({ data: { operation: 'send_webhook', content: 'Hello' } });
    check(noHook.valid === false, 'DiscordNode: rejects send_webhook without webhook URL or connection');

    // get_channel: missing channelId
    const noChan = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'get_channel' } });
    check(noChan.valid === false && noChan.error.includes('Channel ID is required'), 'DiscordNode: rejects get_channel without channelId');

    // Valid configurations
    const validMsg = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'send_message', channelId: '123', content: 'Alert!' } });
    check(validMsg.valid === true, 'DiscordNode: validates valid send_message');

    const validEmbed = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'send_embed', channelId: '123', title: 'New Event' } });
    check(validEmbed.valid === true, 'DiscordNode: validates valid send_embed');

    const validWebhook = discordNode.validate({ data: { webhookUrl: 'https://discord.com/api/webhooks/1/2', operation: 'send_webhook', content: 'Ping' } });
    check(validWebhook.valid === true, 'DiscordNode: validates valid send_webhook');

    const validGet = discordNode.validate({ data: { connectionId: 'conn-bot', operation: 'get_channel', channelId: '123' } });
    check(validGet.valid === true, 'DiscordNode: validates valid get_channel');

    // ── 3. Color Parsing ─────────────────────────────────────────────────────
    console.log('\nTest Group 3: Embed Color Parsing');
    check(discordNode._parseColor('#5865f2') === 5793266, 'DiscordNode: parses hex color #5865f2 to integer 5793266');
    check(discordNode._parseColor('5865f2') === 5793266, 'DiscordNode: parses hex color without hash to integer');
    check(discordNode._parseColor('#ff0000') === 16711680, 'DiscordNode: parses red #ff0000');
    check(discordNode._parseColor(5793266) === 5793266, 'DiscordNode: preserves numeric color value');
    check(discordNode._parseColor('') === undefined, 'DiscordNode: returns undefined for empty color');

    // ── 4. Operation: send_message (Bot) ─────────────────────────────────────
    console.log('\nTest Group 4: Operation send_message (Bot)');

    let botRequestConfig = null;
    const mockBotClient = async (config) => {
      botRequestConfig = config;
      return {
        data: {
          id: '998877665544332211',
          channel_id: '112233445566778899',
          content: config.data?.content,
        },
      };
    };

    const ctx = new ExecutionContext();
    ctx.setResult('step_event', {
      channelId: '112233445566778899',
      serviceName: 'Auth-Service',
      status: 'Healthy',
    });

    const botMsgNode = {
      id: 'discord-bot-msg',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-bot',
        operation: 'send_message',
        channelId: '{{ step_event.channelId }}',
        content: 'Status Report: {{ step_event.serviceName }} is {{ step_event.status }}',
      },
    };

    const botMsgResult = await discordNode.execute(botMsgNode, ctx, { _discordClient: mockBotClient });
    check(botMsgResult.ok === true, 'DiscordNode: bot send_message succeeds');
    check(botMsgResult.id === '998877665544332211', 'DiscordNode: returns message id');
    check(botMsgResult.messageId === '998877665544332211', 'DiscordNode: returns messageId');
    check(botMsgResult.deliveryMethod === 'bot', 'DiscordNode: deliveryMethod is bot');
    check(botRequestConfig.url.includes('/channels/112233445566778899/messages'), 'DiscordNode: calls channel messages endpoint with resolved channelId');
    check(botRequestConfig.headers.Authorization.startsWith('Bot MTAxMjM0NTY3ODkw'), 'DiscordNode: sends Authorization Bot header');
    check(botRequestConfig.data.content === 'Status Report: Auth-Service is Healthy', 'DiscordNode: resolves mustache variables in message content');

    // ── 5. Operation: send_embed ─────────────────────────────────────────────
    console.log('\nTest Group 5: Operation send_embed');

    let embedRequestConfig = null;
    const mockEmbedClient = async (config) => {
      embedRequestConfig = config;
      return {
        data: {
          id: '887766554433221100',
          channel_id: '112233445566778899',
          embeds: config.data?.embeds,
        },
      };
    };

    ctx.setResult('step_incident', {
      title: 'Database Spike',
      region: 'us-east-1',
      latency: '340ms',
    });

    const embedNode = {
      id: 'discord-embed',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-bot',
        operation: 'send_embed',
        channelId: '112233445566778899',
        title: 'Incident: {{ step_incident.title }}',
        description: 'High latency detected in region {{ step_incident.region }}',
        color: '#ff5500',
        footerText: 'LogicBridge Automated Monitor',
        fields: [
          { name: 'Region', value: '{{ step_incident.region }}', inline: true },
          { name: 'Avg Latency', value: '{{ step_incident.latency }}', inline: true },
        ],
      },
    };

    const embedResult = await discordNode.execute(embedNode, ctx, { _discordClient: mockEmbedClient });
    check(embedResult.ok === true, 'DiscordNode: send_embed succeeds');
    check(embedResult.embedsCount === 1, 'DiscordNode: returns embedsCount');
    const sentEmbed = embedRequestConfig.data.embeds[0];
    check(sentEmbed.title === 'Incident: Database Spike', 'DiscordNode: resolves embed title variable');
    check(sentEmbed.description === 'High latency detected in region us-east-1', 'DiscordNode: resolves embed description variable');
    check(sentEmbed.color === 16733440, 'DiscordNode: converts #ff5500 color to decimal');
    check(sentEmbed.footer.text === 'LogicBridge Automated Monitor', 'DiscordNode: includes footer text');
    check(sentEmbed.fields[0].value === 'us-east-1', 'DiscordNode: resolves embed field 1 value');
    check(sentEmbed.fields[1].value === '340ms', 'DiscordNode: resolves embed field 2 value');

    // ── 6. Operation: send_webhook ───────────────────────────────────────────
    console.log('\nTest Group 6: Operation send_webhook');

    let webhookRequestConfig = null;
    const mockWebhookClient = async (config) => {
      webhookRequestConfig = config;
      return {
        data: {
          id: '776655443322110099',
          channel_id: '1234567890',
          content: config.data?.content,
          author: { username: config.data?.username || 'WebhookBot' },
        },
      };
    };

    const webhookNode = {
      id: 'discord-webhook-msg',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-webhook',
        operation: 'send_webhook',
        username: 'CI-Bot',
        avatarUrl: 'https://example.com/ci-avatar.png',
        content: 'CI build passed for commit 7283399',
      },
    };

    const webhookResult = await discordNode.execute(webhookNode, ctx, { _discordClient: mockWebhookClient });
    check(webhookResult.ok === true, 'DiscordNode: send_webhook succeeds');
    check(webhookResult.deliveryMethod === 'webhook', 'DiscordNode: deliveryMethod is webhook');
    check(webhookRequestConfig.data.username === 'CI-Bot', 'DiscordNode: passes custom webhook username');
    check(webhookRequestConfig.data.avatar_url === 'https://example.com/ci-avatar.png', 'DiscordNode: passes custom avatar_url');
    check(webhookRequestConfig.data.content === 'CI build passed for commit 7283399', 'DiscordNode: passes webhook message content');

    // ── 7. Operation: get_channel ────────────────────────────────────────────
    console.log('\nTest Group 7: Operation get_channel');

    const mockGetChannelClient = async (config) => {
      return {
        data: {
          id: '112233445566778899',
          name: 'announcements',
          type: 0,
          topic: 'Official company announcements',
          guild_id: '998877665544332211',
        },
      };
    };

    const getChanNode = {
      id: 'discord-get-chan',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-bot',
        operation: 'get_channel',
        channelId: '112233445566778899',
      },
    };

    const getChanResult = await discordNode.execute(getChanNode, ctx, { _discordClient: mockGetChannelClient });
    check(getChanResult.ok === true, 'DiscordNode: get_channel succeeds');
    check(getChanResult.name === 'announcements', 'DiscordNode: extracts channel name');
    check(getChanResult.topic === 'Official company announcements', 'DiscordNode: extracts channel topic');
    check(getChanResult.guildId === '998877665544332211', 'DiscordNode: extracts guildId');

    // ── 8. Rate Limiting (HTTP 429) & Secret Redaction ───────────────────────
    console.log('\nTest Group 8: Rate Limiting & Secret Redaction');

    let discordAttempts = 0;
    const rateLimitClient = async () => {
      discordAttempts++;
      if (discordAttempts < 2) {
        const err = new Error('Discord rate limit');
        err.response = {
          status: 429,
          data: { message: 'You are being rate limited.', retry_after: 0.1 },
        };
        throw err;
      }
      return {
        data: {
          id: '665544332211009988',
          channel_id: '123',
          content: 'Retried message',
        },
      };
    };

    const retryNode = {
      id: 'discord-retry',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-bot',
        operation: 'send_message',
        channelId: '123',
        content: 'Testing retry backoff',
      },
    };

    const retryResult = await discordNode.execute(retryNode, ctx, { _discordClient: rateLimitClient });
    check(retryResult.ok === true, 'DiscordNode: automatically retries and succeeds after HTTP 429');
    check(discordAttempts === 2, 'DiscordNode: retried after HTTP 429 backoff');

    // Redaction of webhook secret in error
    const failingWebhookClient = async () => {
      const err = new Error('Failed to post to https://discord.com/api/webhooks/12345/superSecretWebhookTokenValue');
      err.response = { status: 404, data: { message: 'Unknown Webhook' } };
      throw err;
    };

    let caughtError = null;
    try {
      await discordNode.execute(
        {
          id: 'discord-err',
          type: NodeTypes.ACTION_DISCORD,
          data: {
            webhookUrl: 'https://discord.com/api/webhooks/12345/superSecretWebhookTokenValue',
            operation: 'send_webhook',
            content: 'Test fail',
          },
        },
        ctx,
        { _discordClient: failingWebhookClient }
      );
    } catch (err) {
      caughtError = err;
    }

    check(Boolean(caughtError), 'DiscordNode: throws NodeExecutionError on API failure');
    check(!caughtError.message.includes('superSecretWebhookTokenValue'), 'DiscordNode: redacts webhook token from error message');
    check(caughtError.message.includes('[REDACTED]'), 'DiscordNode: contains [REDACTED] placeholder in error');

  } finally {
    ConnectionService.getDecryptedCredentials = originalGetCreds;
  }

  console.log(`\nDiscordNode Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('DiscordNode test failed:', err);
  process.exit(1);
});


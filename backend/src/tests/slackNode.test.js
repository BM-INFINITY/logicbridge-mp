/**
 * SlackNode Unit Tests
 * Covers:
 *   - Node metadata and registration
 *   - Validation rules for all operations
 *   - Operations: send_message, send_dm, send_blocks, get_channel
 *   - Dynamic mustache variable resolution in fields and Block Kit
 *   - Rate limit (HTTP 429) handling and retry backoff
 *   - Error handling and token redaction
 */

const assert = require('assert');
const SlackNode = require('../nodes/SlackNode');
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
  console.log('\n🧪 Starting SlackNode Unit Tests...\n');

  const slackNode = new SlackNode();

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-invalid') {
      throw new Error('Connection expired or revoked');
    }
    return {
      token: 'xoxb-mock-secret-bot-token-12345',
      defaultChannel: '#general',
    };
  };

  try {
    // ── 1. Metadata & Registration ───────────────────────────────────────────
    console.log('Test Group 1: Node Metadata');
    check(slackNode.type === NodeTypes.ACTION_SLACK, 'SlackNode: type matches NodeTypes.ACTION_SLACK');
    check(slackNode.name === 'Slack', 'SlackNode: name is Slack');
    check(slackNode.category === 'action', 'SlackNode: category is action');
    check(slackNode.icon === 'MessageSquare', 'SlackNode: icon is MessageSquare');

    // ── 2. Validation ────────────────────────────────────────────────────────
    console.log('\nTest Group 2: Validation');

    // Missing connection/token
    const noConn = slackNode.validate({ data: { operation: 'send_message', channel: '#general', text: 'Hi' } });
    check(noConn.valid === false && noConn.error.includes('connection is required'), 'SlackNode: rejects missing connection or token');

    // Invalid operation
    const badOp = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'drop_database' } });
    check(badOp.valid === false && badOp.error.includes('Invalid operation'), 'SlackNode: rejects invalid operation');

    // send_message: missing channel
    const noChan = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_message', text: 'Hi' } });
    check(noChan.valid === false && noChan.error.includes('Destination channel is required'), 'SlackNode: rejects send_message without channel');

    // send_message: missing text
    const noText = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_message', channel: '#general' } });
    check(noText.valid === false && noText.error.includes('Message text is required'), 'SlackNode: rejects send_message without text');

    // send_dm: missing userId
    const noUser = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_dm', text: 'Hi' } });
    check(noUser.valid === false && noUser.error.includes('User ID is required'), 'SlackNode: rejects send_dm without userId');

    // send_blocks: missing blocks/text
    const noBlocks = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_blocks', channel: '#general' } });
    check(noBlocks.valid === false && noBlocks.error.includes('Blocks or fallback text is required'), 'SlackNode: rejects send_blocks without blocks or text');

    // get_channel: missing channel
    const noGetChan = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'get_channel' } });
    check(noGetChan.valid === false && noGetChan.error.includes('Channel ID is required'), 'SlackNode: rejects get_channel without channel');

    // Valid configurations
    const validMsg = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_message', channel: '#alerts', text: 'Deployment OK' } });
    check(validMsg.valid === true, 'SlackNode: validates valid send_message payload');

    const validDm = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_dm', userId: 'U12345', text: 'Hello' } });
    check(validDm.valid === true, 'SlackNode: validates valid send_dm payload');

    const validBlocks = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'send_blocks', channel: 'C0123', blocks: '[]' } });
    check(validBlocks.valid === true, 'SlackNode: validates valid send_blocks payload');

    const validInfo = slackNode.validate({ data: { connectionId: 'conn-1', operation: 'get_channel', channel: 'C0123' } });
    check(validInfo.valid === true, 'SlackNode: validates valid get_channel payload');

    // ── 3. Operation: send_message ───────────────────────────────────────────
    console.log('\nTest Group 3: Operation send_message');

    let postedMessageBody = null;
    const mockClientPostMsg = async (opts) => {
      if (opts.url === 'https://slack.com/api/chat.postMessage') {
        postedMessageBody = opts.data;
        return {
          data: {
            ok: true,
            channel: opts.data.channel,
            ts: '1700000000.000100',
            message: {
              bot_id: 'B0123',
              type: 'message',
              text: opts.data.text,
              ts: '1700000000.000100',
            },
          },
        };
      }
      throw new Error(`Unexpected endpoint ${opts.url}`);
    };

    const ctx = new ExecutionContext();
    ctx.setResult('prev_step', {
      targetChannel: '#deployments',
      appName: 'LogicBridge',
      status: 'SUCCESS',
    });

    const sendMsgNode = {
      id: 'slack-1',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-1',
        operation: 'send_message',
        channel: '{{ prev_step.targetChannel }}',
        text: 'Build for {{ prev_step.appName }} completed with status: {{ prev_step.status }}',
        threadTs: '1699999999.000050',
      },
    };

    const resultMsg = await slackNode.execute(sendMsgNode, ctx, { _slackClient: mockClientPostMsg });
    check(resultMsg.ok === true, 'SlackNode: send_message succeeds');
    check(resultMsg.channel === '#deployments', 'SlackNode: channel variable resolved');
    check(resultMsg.text.includes('LogicBridge completed with status: SUCCESS'), 'SlackNode: text variables resolved');
    check(resultMsg.messageId === '1700000000.000100', 'SlackNode: returns messageId / timestamp');
    check(postedMessageBody.thread_ts === '1699999999.000050', 'SlackNode: passes thread_ts in request');

    // ── 4. Operation: send_dm ────────────────────────────────────────────────
    console.log('\nTest Group 4: Operation send_dm');

    let openDmRequestedUser = null;
    let dmPostedChannel = null;
    const mockClientDm = async (opts) => {
      if (opts.url === 'https://slack.com/api/conversations.open') {
        openDmRequestedUser = opts.data.users;
        return {
          data: {
            ok: true,
            channel: { id: 'D0123456789' },
          },
        };
      }
      if (opts.url === 'https://slack.com/api/chat.postMessage') {
        dmPostedChannel = opts.data.channel;
        return {
          data: {
            ok: true,
            channel: opts.data.channel,
            ts: '1700000005.000200',
            message: { text: opts.data.text },
          },
        };
      }
      throw new Error(`Unexpected endpoint ${opts.url}`);
    };

    ctx.setResult('step_user', { leadDev: 'U987654321' });
    const dmNode = {
      id: 'slack-dm',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-1',
        operation: 'send_dm',
        userId: '{{ step_user.leadDev }}',
        text: 'Direct message for your review',
      },
    };

    const resultDm = await slackNode.execute(dmNode, ctx, { _slackClient: mockClientDm });
    check(resultDm.ok === true, 'SlackNode: send_dm succeeds');
    check(openDmRequestedUser === 'U987654321', 'SlackNode: calls conversations.open with resolved userId');
    check(dmPostedChannel === 'D0123456789', 'SlackNode: posts message to opened DM channel');
    check(resultDm.dmChannelId === 'D0123456789', 'SlackNode: returns dmChannelId in output');

    // ── 5. Operation: send_blocks ────────────────────────────────────────────
    console.log('\nTest Group 5: Operation send_blocks (Block Kit)');

    let blocksPosted = null;
    const mockClientBlocks = async (opts) => {
      if (opts.url === 'https://slack.com/api/chat.postMessage') {
        blocksPosted = opts.data.blocks;
        return {
          data: {
            ok: true,
            channel: opts.data.channel,
            ts: '1700000010.000300',
            message: { blocks: opts.data.blocks },
          },
        };
      }
      throw new Error(`Unexpected endpoint ${opts.url}`);
    };

    ctx.setResult('step_metrics', {
      serverHost: 'api.prod.internal',
      cpuUsage: '92%',
    });

    const blocksNode = {
      id: 'slack-blocks',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-1',
        operation: 'send_blocks',
        channel: '#ops-alerts',
        text: 'High CPU alert',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Server Alert: {{ step_metrics.serverHost }}' },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Metric:*\nCPU Usage' },
              { type: 'mrkdwn', text: '*Value:*\n{{ step_metrics.cpuUsage }}' },
            ],
          },
        ],
      },
    };

    const resultBlocks = await slackNode.execute(blocksNode, ctx, { _slackClient: mockClientBlocks });
    check(resultBlocks.ok === true, 'SlackNode: send_blocks succeeds');
    check(Array.isArray(blocksPosted), 'SlackNode: sends parsed blocks array');
    check(blocksPosted[0].text.text === 'Server Alert: api.prod.internal', 'SlackNode: resolves mustache variable in header block');
    check(blocksPosted[1].fields[1].text === '*Value:*\n92%', 'SlackNode: resolves mustache variable in nested section fields');

    // ── 6. Operation: get_channel ────────────────────────────────────────────
    console.log('\nTest Group 6: Operation get_channel');

    const mockClientInfo = async (opts) => {
      if (opts.url.includes('https://slack.com/api/conversations.info')) {
        return {
          data: {
            ok: true,
            channel: {
              id: 'C0123456789',
              name: 'engineering',
              is_channel: true,
              is_private: false,
              topic: { value: 'All engineering discussions' },
              purpose: { value: 'LogicBridge engineering team' },
              num_members: 42,
            },
          },
        };
      }
      throw new Error(`Unexpected endpoint ${opts.url}`);
    };

    const infoNode = {
      id: 'slack-info',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-1',
        operation: 'get_channel',
        channel: 'C0123456789',
      },
    };

    const resultInfo = await slackNode.execute(infoNode, ctx, { _slackClient: mockClientInfo });
    check(resultInfo.ok === true, 'SlackNode: get_channel succeeds');
    check(resultInfo.channel.name === 'engineering', 'SlackNode: extracts channel name');
    check(resultInfo.channel.is_private === false, 'SlackNode: extracts privacy flag');
    check(resultInfo.channel.num_members === 42, 'SlackNode: extracts member count');

    // ── 7. Rate Limit (HTTP 429) & Error Redaction ───────────────────────────
    console.log('\nTest Group 7: Rate Limit Handling & Error Redaction');

    let attemptCount = 0;
    const rateLimitClient = async () => {
      attemptCount++;
      if (attemptCount < 2) {
        const err = new Error('Rate limited');
        err.response = {
          status: 429,
          headers: { 'retry-after': '0' },
          data: { ok: false, error: 'ratelimited' },
        };
        throw err;
      }
      return {
        data: {
          ok: true,
          channel: 'C01',
          ts: '1700000099.000999',
        },
      };
    };

    const retryNode = {
      id: 'slack-retry',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-1',
        operation: 'send_message',
        channel: 'C01',
        text: 'Testing retry backoff',
      },
    };

    const retryResult = await slackNode.execute(retryNode, ctx, { _slackClient: rateLimitClient });
    check(retryResult.ok === true, 'SlackNode: automatically retries and succeeds after HTTP 429');
    check(attemptCount === 2, 'SlackNode: retried exactly once after rate limit response');

    // API Error with token redaction
    const failingClient = async () => {
      const err = new Error('Slack API error: channel_not_found using token xoxb-12345-secret');
      err.response = { status: 200, data: { ok: false, error: 'channel_not_found' } };
      throw err;
    };

    let caughtError = null;
    try {
      await slackNode.execute(
        {
          id: 'slack-err',
          type: NodeTypes.ACTION_SLACK,
          data: {
            connectionId: 'conn-1',
            operation: 'send_message',
            channel: 'C_UNKNOWN',
            text: 'Fail message',
          },
        },
        ctx,
        { _slackClient: failingClient }
      );
    } catch (err) {
      caughtError = err;
    }

    check(Boolean(caughtError), 'SlackNode: throws NodeExecutionError on API failure');
    check(!caughtError.message.includes('xoxb-12345-secret'), 'SlackNode: redacts bot token from error message');
    check(caughtError.message.includes('channel_not_found'), 'SlackNode: preserves descriptive Slack error code');

  } finally {
    ConnectionService.getDecryptedCredentials = originalGetCreds;
  }

  console.log(`\nSlackNode Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('SlackNode test failed:', err);
  process.exit(1);
});

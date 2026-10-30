/**
 * Frontend Slack & Discord Node Configuration & Validation Unit Tests
 * Covers:
 *   - action-slack validation rules in NodeValidator
 *   - action-discord validation rules in NodeValidator
 *   - DefaultNodeData defaults for Slack and Discord
 *   - Icon mapping and resolution
 */

import NodeValidator from '../validators/NodeValidator.js';
import { NodeTypes } from '../constants/NodeTypes.js';
import DefaultNodeData from '../constants/DefaultNodeData.js';
import { getNodeIcon, getProviderIcon } from '../constants/Icons.js';

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

function main() {
  console.log('\n🧪 Starting Frontend Slack & Discord Node Validation Unit Tests...\n');

  // ── Group 1: Slack Validation Rules ─────────────────────────────────────────
  console.log('Group 1: Slack Node Validation');

  // Valid send_message
  const validSlackMsg = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-slack-1',
      operation: 'send_message',
      channel: '#general',
      text: 'Deployment succeeded',
    },
  };
  assert(NodeValidator.validateNode(validSlackMsg).valid === true, 'Slack: validates valid send_message');

  // Missing connection
  const noConnSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      operation: 'send_message',
      channel: '#general',
      text: 'Deployment succeeded',
    },
  };
  const noConnSlackRes = NodeValidator.validateNode(noConnSlack);
  assert(noConnSlackRes.valid === false && noConnSlackRes.error?.includes('Slack connection is required'), 'Slack: rejects missing connection');

  // Direct token fallback is valid
  const directTokenSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      token: 'xoxb-direct-token-12345',
      operation: 'send_message',
      channel: '#general',
      text: 'Direct token message',
    },
  };
  assert(NodeValidator.validateNode(directTokenSlack).valid === true, 'Slack: accepts direct token');

  // Missing channel
  const noChannelSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'send_message',
      text: 'Hello',
    },
  };
  const noChannelSlackRes = NodeValidator.validateNode(noChannelSlack);
  assert(noChannelSlackRes.valid === false && noChannelSlackRes.error?.includes('Destination channel is required'), 'Slack: rejects send_message missing channel');

  // Missing text
  const noTextSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'send_message',
      channel: '#general',
    },
  };
  const noTextSlackRes = NodeValidator.validateNode(noTextSlack);
  assert(noTextSlackRes.valid === false && noTextSlackRes.error?.includes('Message text is required'), 'Slack: rejects send_message missing text');

  // Valid send_dm
  const validDmSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'send_dm',
      userId: 'U12345678',
      text: 'Direct reminder',
    },
  };
  assert(NodeValidator.validateNode(validDmSlack).valid === true, 'Slack: validates valid send_dm');

  // Missing userId for send_dm
  const noUserDm = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'send_dm',
      text: 'Direct reminder',
    },
  };
  const noUserDmRes = NodeValidator.validateNode(noUserDm);
  assert(noUserDmRes.valid === false && noUserDmRes.error?.includes('User ID is required'), 'Slack: rejects send_dm missing userId');

  // Valid send_blocks
  const validBlocksSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'send_blocks',
      channel: 'C0123',
      blocks: '[{"type":"section","text":{"type":"mrkdwn","text":"Alert"}}]',
    },
  };
  assert(NodeValidator.validateNode(validBlocksSlack).valid === true, 'Slack: validates valid send_blocks');

  // Valid get_channel
  const validGetChannelSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'get_channel',
      channel: 'C0123456',
    },
  };
  assert(NodeValidator.validateNode(validGetChannelSlack).valid === true, 'Slack: validates valid get_channel');

  // Missing channel for get_channel
  const noChanGet = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'get_channel',
    },
  };
  assert(NodeValidator.validateNode(noChanGet).valid === false, 'Slack: rejects get_channel missing channel');

  // Invalid operation
  const invalidOpSlack = {
    type: NodeTypes.ACTION_SLACK,
    data: {
      connectionId: 'conn-1',
      operation: 'delete_workspace',
    },
  };
  assert(NodeValidator.validateNode(invalidOpSlack).valid === false, 'Slack: rejects unsupported operation');

  // ── Group 2: Discord Validation Rules ───────────────────────────────────────
  console.log('\nGroup 2: Discord Node Validation');

  // Valid bot send_message
  const validDiscordMsg = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-discord-1',
      operation: 'send_message',
      channelId: '987654321098765432',
      content: 'Server update complete',
    },
  };
  assert(NodeValidator.validateNode(validDiscordMsg).valid === true, 'Discord: validates valid send_message');

  // Missing connection / token / webhook
  const noConnDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      operation: 'send_message',
      channelId: '987654321098765432',
      content: 'Server update complete',
    },
  };
  const noConnDiscordRes = NodeValidator.validateNode(noConnDiscord);
  assert(noConnDiscordRes.valid === false && noConnDiscordRes.error?.includes('Discord connection, Bot Token, or Webhook URL is required'), 'Discord: rejects missing connection, token, and webhook');

  // Missing content for send_message
  const noContentDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-1',
      operation: 'send_message',
      channelId: '987654321',
    },
  };
  const noContentDiscordRes = NodeValidator.validateNode(noContentDiscord);
  assert(noContentDiscordRes.valid === false && noContentDiscordRes.error?.includes('Message content is required'), 'Discord: rejects send_message missing content');

  // Valid send_embed
  const validEmbedDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-1',
      operation: 'send_embed',
      channelId: '987654321',
      title: 'Deployment Report',
      description: 'Pipeline completed successfully',
      color: '#5865f2',
    },
  };
  assert(NodeValidator.validateNode(validEmbedDiscord).valid === true, 'Discord: validates valid send_embed');

  // Missing embed fields for send_embed
  const noEmbedFieldsDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-1',
      operation: 'send_embed',
      channelId: '987654321',
    },
  };
  const noEmbedFieldsDiscordRes = NodeValidator.validateNode(noEmbedFieldsDiscord);
  assert(noEmbedFieldsDiscordRes.valid === false && noEmbedFieldsDiscordRes.error?.includes('Embed data or title/description is required'), 'Discord: rejects send_embed without title, description, or embed data');

  // Valid send_webhook
  const validWebhookDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      operation: 'send_webhook',
      content: 'Automated notification',
    },
  };
  assert(NodeValidator.validateNode(validWebhookDiscord).valid === true, 'Discord: validates valid send_webhook');

  // Missing webhook URL for send_webhook
  const noHookDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      operation: 'send_webhook',
      content: 'Notification',
    },
  };
  assert(NodeValidator.validateNode(noHookDiscord).valid === false, 'Discord: rejects send_webhook without webhook URL');

  // Valid get_channel
  const validGetChanDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-1',
      operation: 'get_channel',
      channelId: '123456789',
    },
  };
  assert(NodeValidator.validateNode(validGetChanDiscord).valid === true, 'Discord: validates valid get_channel');

  // Missing channelId for get_channel
  const noChanDiscord = {
    type: NodeTypes.ACTION_DISCORD,
    data: {
      connectionId: 'conn-1',
      operation: 'get_channel',
    },
  };
  assert(NodeValidator.validateNode(noChanDiscord).valid === false, 'Discord: rejects get_channel missing channelId');

  // ── Group 3: Default Node Data & Icons ─────────────────────────────────────
  console.log('\nGroup 3: Default Node Data & Icon Resolution');

  // DefaultNodeData checks
  const slackDefaults = DefaultNodeData[NodeTypes.ACTION_SLACK];
  assert(Boolean(slackDefaults), 'DefaultNodeData: has entry for ACTION_SLACK');
  assert(slackDefaults.operation === 'send_message', 'DefaultNodeData: Slack default operation is send_message');
  assert(slackDefaults.label === 'Slack', 'DefaultNodeData: Slack default label is Slack');

  const discordDefaults = DefaultNodeData[NodeTypes.ACTION_DISCORD];
  assert(Boolean(discordDefaults), 'DefaultNodeData: has entry for ACTION_DISCORD');
  assert(discordDefaults.operation === 'send_message', 'DefaultNodeData: Discord default operation is send_message');
  assert(discordDefaults.label === 'Discord', 'DefaultNodeData: Discord default label is Discord');

  // Icon resolution checks
  const slackNodeIcon = getNodeIcon(NodeTypes.ACTION_SLACK);
  assert(typeof slackNodeIcon === 'object' || typeof slackNodeIcon === 'function', 'getNodeIcon: resolves icon for action-slack');

  const discordNodeIcon = getNodeIcon(NodeTypes.ACTION_DISCORD);
  assert(typeof discordNodeIcon === 'object' || typeof discordNodeIcon === 'function', 'getNodeIcon: resolves icon for action-discord');

  const slackProviderIcon = getProviderIcon('slack');
  assert(typeof slackProviderIcon === 'object' || typeof slackProviderIcon === 'function', 'getProviderIcon: resolves icon for slack provider');

  const discordProviderIcon = getProviderIcon('discord');
  assert(typeof discordProviderIcon === 'object' || typeof discordProviderIcon === 'function', 'getProviderIcon: resolves icon for discord provider');

  console.log(`\nFrontend Slack & Discord Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();


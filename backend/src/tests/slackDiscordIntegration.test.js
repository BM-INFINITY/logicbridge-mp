/**
 * Slack & Discord Workflow Integration Tests
 * Covers:
 *   - Multi-step pipeline: HTTP -> Transform -> Slack
 *   - Multi-step pipeline: Webhook -> Condition -> Discord Embed
 *   - Workflow serialization and round-trip export/import compatibility
 */

const assert = require('assert');
const SlackNode = require('../nodes/SlackNode');
const DiscordNode = require('../nodes/DiscordNode');
const TransformNode = require('../nodes/TransformNode');
const ConditionNode = require('../nodes/ConditionNode');
const ExecutionContext = require('../utils/ExecutionContext');
const WorkflowSerializer = require('../services/WorkflowSerializer');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');
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
  console.log('\n🧪 Starting Slack & Discord Workflow Integration Tests...\n');

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-slack') {
      return { token: 'xoxb-mock-slack-token', defaultChannel: '#ops' };
    }
    if (connId === 'conn-discord') {
      return { botToken: 'MTA...MockDiscordBotToken' };
    }
    throw new Error('Unknown connection');
  };

  try {
    // ── Pipeline 1: HTTP -> Transform -> Slack ──────────────────────────────
    console.log('Test Group 1: Pipeline HTTP -> Transform -> Slack');

    const ctx1 = new ExecutionContext();

    // 1. Mock step 1 (HTTP output)
    ctx1.setResult('http_step', {
      status: 200,
      data: {
        service: 'checkout-service',
        environment: 'production',
        latencyMs: 820,
        errorRate: '4.2%',
      },
    });

    // 2. Step 2: Transform node
    const transformNode = new TransformNode();
    const transformStep = {
      id: 'transform_step',
      type: NodeTypes.ACTION_TRANSFORM,
      data: {
        operation: 'map',
        mappings: [
          { source: '{{ http_step.data.service }}', outputField: 'svc' },
          { source: '{{ http_step.data.environment }}', outputField: 'env' },
          { source: '{{ http_step.data.errorRate }}', outputField: 'err' },
        ],
      },
    };

    const transformOutput = await transformNode.execute(transformStep, ctx1);
    ctx1.setResult('transform_step', transformOutput);
    check(transformOutput.data.svc === 'checkout-service', 'Pipeline 1: Transform maps service name');
    check(transformOutput.data.err === '4.2%', 'Pipeline 1: Transform maps error rate');

    // 3. Step 3: Slack node sends notification using transformed data
    let postedSlackMessage = null;
    const mockSlackClient = async (opts) => {
      postedSlackMessage = opts.data;
      return {
        data: {
          ok: true,
          channel: opts.data.channel,
          ts: '1700000000.123456',
          message: { text: opts.data.text },
        },
      };
    };

    const slackNode = new SlackNode();
    const slackStep = {
      id: 'slack_step',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-slack',
        operation: 'send_message',
        channel: '#prod-alerts',
        text: 'Alert: Service {{ transform_step.data.svc }} in {{ transform_step.data.env }} has high error rate: {{ transform_step.data.err }}',
      },
    };

    const slackOutput = await slackNode.execute(slackStep, ctx1, { _slackClient: mockSlackClient });
    ctx1.setResult('slack_step', slackOutput);
    check(slackOutput.ok === true, 'Pipeline 1: Slack node executes successfully');
    check(
      postedSlackMessage.text === 'Alert: Service checkout-service in production has high error rate: 4.2%',
      'Pipeline 1: Slack text resolves multi-step chained variables'
    );
    check(postedSlackMessage.channel === '#prod-alerts', 'Pipeline 1: Slack target channel preserved');

    // ── Pipeline 2: Webhook -> Condition -> Discord Embed ───────────────────
    console.log('\nTest Group 2: Pipeline Webhook -> Condition -> Discord Embed');

    const ctx2 = new ExecutionContext();

    // 1. Step 1: Webhook payload
    ctx2.setResult('webhook_trigger', {
      severity: 'critical',
      issue: 'Out of Memory',
      pod: 'billing-worker-7c64d84f9-2kx9q',
      cluster: 'k8s-prod-us-central',
    });

    // 2. Step 2: Condition node
    const conditionNode = new ConditionNode();
    const conditionStep = {
      id: 'cond_step',
      type: NodeTypes.LOGIC_CONDITION,
      data: {
        leftValue: '{{ webhook_trigger.severity }}',
        operator: 'equals',
        rightValue: 'critical',
      },
    };

    const conditionOutput = await conditionNode.execute(conditionStep, ctx2);
    ctx2.setResult('cond_step', conditionOutput);
    check(conditionOutput.passed === true, 'Pipeline 2: Condition evaluates critical severity as TRUE');

    // 3. Step 3: Discord Embed on true branch
    let sentDiscordEmbed = null;
    const mockDiscordClient = async (opts) => {
      sentDiscordEmbed = opts.data?.embeds?.[0];
      return {
        data: {
          id: '554433221100998877',
          channel_id: '9988776655',
          embeds: opts.data?.embeds,
        },
      };
    };

    const discordNode = new DiscordNode();
    const discordStep = {
      id: 'discord_step',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-discord',
        operation: 'send_embed',
        channelId: '9988776655',
        title: 'Cluster Alert: {{ webhook_trigger.issue }}',
        description: 'Severity: {{ webhook_trigger.severity }} detected in {{ webhook_trigger.cluster }}',
        color: '#e01e5a',
        footerText: 'Kubernetes Cluster Monitor',
        fields: [
          { name: 'Pod', value: '{{ webhook_trigger.pod }}', inline: true },
          { name: 'Cluster', value: '{{ webhook_trigger.cluster }}', inline: true },
        ],
      },
    };

    const discordOutput = await discordNode.execute(discordStep, ctx2, { _discordClient: mockDiscordClient });
    ctx2.setResult('discord_step', discordOutput);
    check(discordOutput.ok === true, 'Pipeline 2: Discord Embed node executes successfully');
    check(sentDiscordEmbed.title === 'Cluster Alert: Out of Memory', 'Pipeline 2: Discord embed resolves issue variable');
    check(sentDiscordEmbed.fields[0].value === 'billing-worker-7c64d84f9-2kx9q', 'Pipeline 2: Discord embed resolves pod variable');
    check(sentDiscordEmbed.color === 14687834, 'Pipeline 2: Discord color converted to decimal');

    // ── Serialization & Round-Trip ───────────────────────────────────────────
    console.log('\nTest Group 3: Workflow Serialization & Round-Trip Compatibility');

    const multiChannelWorkflow = {
      name: 'Omni-Channel Alert System',
      description: 'Sends alerts to both Slack and Discord upon critical webhook triggers',
      nodes: [
        {
          id: 'trig-1',
          type: 'trigger-webhook',
          position: { x: 50, y: 150 },
          data: { label: 'Webhook Receiver', path: '/alerts/incoming' },
        },
        {
          id: 'cond-1',
          type: 'logic-condition',
          position: { x: 250, y: 150 },
          data: { label: 'Check Severity', field: 'severity', operator: 'equals', value: 'critical' },
        },
        {
          id: 'slack-1',
          type: 'action-slack',
          position: { x: 500, y: 50 },
          data: {
            label: 'Notify Slack',
            connectionId: 'conn-slack-123',
            operation: 'send_message',
            channel: '#critical-incidents',
            text: 'Critical Incident: {{ trig-1.message }}',
          },
        },
        {
          id: 'discord-1',
          type: 'action-discord',
          position: { x: 500, y: 250 },
          data: {
            label: 'Notify Discord',
            connectionId: 'conn-discord-456',
            operation: 'send_embed',
            channelId: '987654321',
            title: 'Critical Incident',
            description: '{{ trig-1.message }}',
            color: '#ff0000',
          },
        },
      ],
      edges: [
        { id: 'e-1', source: 'trig-1', target: 'cond-1' },
        { id: 'e-2', source: 'cond-1', target: 'slack-1', sourceHandle: 'true' },
        { id: 'e-3', source: 'cond-1', target: 'discord-1', sourceHandle: 'true' },
      ],
    };

    // 1. Round trip test
    const roundTripRes = WorkflowSerializer.roundTripTest(multiChannelWorkflow);
    check(roundTripRes.success === true, 'WorkflowSerializer: round-trip serialization succeeds for Slack + Discord workflow');

    // 2. Validate serialized payload
    const serializedPkg = WorkflowSerializer.serialize(multiChannelWorkflow);
    check(Boolean(serializedPkg.manifest), 'WorkflowSerializer: creates valid manifest');
    check(serializedPkg.manifest.schemaVersion === '1.0.0', 'WorkflowSerializer: schemaVersion is 1.0.0');
    check(serializedPkg.workflow.nodes.length === 4, 'WorkflowSerializer: preserves all 4 nodes');
    check(serializedPkg.workflow.edges.length === 3, 'WorkflowSerializer: preserves all 3 edges');

    const importValidation = WorkflowImportValidator.validate(serializedPkg);
    check(importValidation.valid === true, 'WorkflowImportValidator: approves exported workflow package');
    check(importValidation.errors.length === 0, 'WorkflowImportValidator: 0 errors detected');

    // 3. Deserialize back and verify node properties
    const deserializedWf = WorkflowSerializer.deserialize(serializedPkg);
    const slackNodeDef = deserializedWf.nodes.find((n) => n.id === 'slack-1');
    const discordNodeDef = deserializedWf.nodes.find((n) => n.id === 'discord-1');

    check(Boolean(slackNodeDef), 'Deserialized workflow contains Slack node');
    check(slackNodeDef.type === 'action-slack', 'Slack node type preserved as action-slack');
    check(slackNodeDef.data.operation === 'send_message', 'Slack node operation preserved');

    check(Boolean(discordNodeDef), 'Deserialized workflow contains Discord node');
    check(discordNodeDef.type === 'action-discord', 'Discord node type preserved as action-discord');
    check(discordNodeDef.data.operation === 'send_embed', 'Discord node operation preserved');

  } finally {
    ConnectionService.getDecryptedCredentials = originalGetCreds;
  }

  console.log(`\nSlack & Discord Integration Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

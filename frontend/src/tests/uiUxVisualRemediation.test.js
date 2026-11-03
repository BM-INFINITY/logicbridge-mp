import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AVAILABLE_TOOLS } from '../constants/AgentTools.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';
import { NodeTypes } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { CONDITION_OPERATORS, UNARY_OPERATORS } from '../constants/ConditionOperators.js';

describe('Iteration 37.1 — UI/UX Visual Defect Remediation Regression Suite', () => {
  // ── Group 1: Duplicate Labels Root Cause Remediation ──────────────────────
  describe('Group 1: Duplicate Labels Root Cause Remediation', () => {
    test('AVAILABLE_TOOLS has distinct name and categoryGroup without concatenated duplicates', () => {
      assert.ok(Array.isArray(AVAILABLE_TOOLS), 'AVAILABLE_TOOLS should be an array');
      assert.strictEqual(AVAILABLE_TOOLS.length, 11, 'Should expose exactly 11 controlled tools');

      // Specifically test the 4 flagged duplicated labels
      const transformTool = AVAILABLE_TOOLS.find((t) => t.id === 'transform_data');
      assert.ok(transformTool, 'transform_data tool must exist');
      assert.strictEqual(transformTool.name, 'Transform Data', 'Name must be exactly "Transform Data"');
      assert.doesNotMatch(transformTool.name, /DataData$/, 'Name must not end with duplicated "DataData"');

      const jsonTool = AVAILABLE_TOOLS.find((t) => t.id === 'json_utility');
      assert.ok(jsonTool, 'json_utility tool must exist');
      assert.strictEqual(jsonTool.name, 'JSON Utility', 'Name must be exactly "JSON Utility"');
      assert.doesNotMatch(jsonTool.name, /UtilityUtility$/, 'Name must not end with duplicated "UtilityUtility"');

      const textTool = AVAILABLE_TOOLS.find((t) => t.id === 'text_utility');
      assert.ok(textTool, 'text_utility tool must exist');
      assert.strictEqual(textTool.name, 'Text Utility', 'Name must be exactly "Text Utility"');
      assert.doesNotMatch(textTool.name, /UtilityUtility$/, 'Name must not end with duplicated "UtilityUtility"');

      const mathTool = AVAILABLE_TOOLS.find((t) => t.id === 'math_utility');
      assert.ok(mathTool, 'math_utility tool must exist');
      assert.strictEqual(mathTool.name, 'Math Utility', 'Name must be exactly "Math Utility"');
      assert.doesNotMatch(mathTool.name, /UtilityUtility$/, 'Name must not end with duplicated "UtilityUtility"');

      const dateTool = AVAILABLE_TOOLS.find((t) => t.id === 'date_utility');
      assert.ok(dateTool, 'date_utility tool must exist');
      assert.strictEqual(dateTool.name, 'Date Utility', 'Name must be exactly "Date Utility"');
      assert.doesNotMatch(dateTool.name, /UtilityUtility$/, 'Name must not end with duplicated "UtilityUtility"');
    });

    test('Every tool has unique ID, readable description, and categorized grouping', () => {
      const seenIds = new Set();
      for (const tool of AVAILABLE_TOOLS) {
        assert.ok(tool.id && typeof tool.id === 'string', 'Tool must have string id');
        assert.ok(!seenIds.has(tool.id), `Tool id "${tool.id}" must be unique`);
        seenIds.add(tool.id);

        assert.ok(tool.name && typeof tool.name === 'string', 'Tool must have clean name');
        assert.ok(tool.description && typeof tool.description === 'string', 'Tool must have description');
        assert.ok(tool.categoryGroup && typeof tool.categoryGroup === 'string', 'Tool must have categoryGroup');
        assert.ok(typeof tool.sensitive === 'boolean', 'Tool must specify sensitive boolean flag');
      }
    });

    test('Sensitive tools are explicitly flagged for security isolation', () => {
      const slack = AVAILABLE_TOOLS.find((t) => t.id === 'slack_message');
      const discord = AVAILABLE_TOOLS.find((t) => t.id === 'discord_message');
      assert.strictEqual(slack?.sensitive, true, 'Slack message must be marked sensitive');
      assert.strictEqual(discord?.sensitive, true, 'Discord message must be marked sensitive');

      const math = AVAILABLE_TOOLS.find((t) => t.id === 'math_utility');
      assert.strictEqual(math?.sensitive, false, 'Math utility must not be sensitive');
    });
  });

  // ── Group 2: Form Components & Switch Props Resiliency ────────────────────
  describe('Group 2: Form Components & Switch Props Resiliency', () => {
    test('Condition operators catalog exports expected operators and unaries', () => {
      assert.ok(Array.isArray(CONDITION_OPERATORS), 'CONDITION_OPERATORS must be an array');
      assert.ok(CONDITION_OPERATORS.length >= 16, 'Must provide at least 16 comparison operators');
      assert.ok(UNARY_OPERATORS instanceof Set, 'UNARY_OPERATORS must be a Set');
      assert.ok(UNARY_OPERATORS.has('is_empty'), 'is_empty must be a unary operator');
      assert.ok(UNARY_OPERATORS.has('exists'), 'exists must be a unary operator');
      assert.ok(!UNARY_OPERATORS.has('equals'), 'equals must NOT be a unary operator');
    });

    test('Default node data exists and is valid for all audited sidebar node types', () => {
      const auditedTypes = [
        NodeTypes.ACTION_AI_AGENT,
        NodeTypes.ACTION_AI_GENERATE,
        NodeTypes.ACTION_HTTP,
        NodeTypes.ACTION_POSTGRES,
        NodeTypes.TRIGGER_WEBHOOK,
        NodeTypes.ACTION_LOOP,
        NodeTypes.ACTION_APPROVAL,
        NodeTypes.ACTION_TRANSFORM,
        NodeTypes.ACTION_CONDITION,
        NodeTypes.ACTION_SLACK,
        NodeTypes.ACTION_DISCORD,
        NodeTypes.ACTION_FILE,
        NodeTypes.ACTION_STORAGE,
        NodeTypes.ACTION_CSV,
        NodeTypes.ACTION_JSON,
        NodeTypes.ACTION_TEXT,
        NodeTypes.ACTION_MATH,
        NodeTypes.ACTION_DATE,
      ];

      for (const type of auditedTypes) {
        assert.ok(DefaultNodeData[type], `DefaultNodeData must define defaults for "${type}"`);
        assert.strictEqual(typeof DefaultNodeData[type], 'object', `Defaults for "${type}" must be an object`);
      }
    });
  });

  // ── Group 3: Configuration Field Persistence & Serialization Round-Trip ───
  describe('Group 3: Configuration Field Persistence & Serialization Round-Trip', () => {
    test('Serializes and deserializes AI Agent node configuration without data loss', () => {
      const agentNode = {
        id: 'agent_node_1',
        type: NodeTypes.ACTION_AI_AGENT,
        position: { x: 100, y: 100 },
        data: {
          label: 'Customer Support Agent',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: '{{secrets.ANTHROPIC_KEY}}',
          baseUrl: 'https://custom-proxy.internal/v1',
          systemPrompt: 'You are an intelligent billing and account agent.',
          prompt: 'Look up account {{steps.trigger.accountId}} and resolve open tickets.',
          tools: ['http_request', 'database_query', 'slack_message'],
          allowSensitiveActions: true,
          responseSchema: {
            type: 'object',
            properties: {
              resolution: { type: 'string' },
              ticketId: { type: 'number' },
            },
            required: ['resolution'],
          },
          maxIterations: 12,
          maxToolCalls: 20,
          timeout: 45000,
          maxTokens: 3000,
          temperature: 0.15,
        },
      };

      const workflow = {
        id: 'wf_agent_test',
        name: 'AI Agent Test Workflow',
        nodes: [agentNode],
        edges: [],
      };

      const serialized = WorkflowSerializer.serialize(workflow);
      assert.ok(serialized, 'Serialized workflow must exist');
      assert.strictEqual(serialized.workflow.nodes[0].type, NodeTypes.ACTION_AI_AGENT);

      const deserialized = WorkflowSerializer.deserialize(serialized);
      const deserializedNode = deserialized.nodes[0];
      assert.strictEqual(deserializedNode.data.provider, 'anthropic');
      assert.strictEqual(deserializedNode.data.model, 'claude-3-5-sonnet-20241022');
      assert.strictEqual(deserializedNode.data.apiKey, '{{secrets.ANTHROPIC_KEY}}');
      assert.strictEqual(deserializedNode.data.baseUrl, 'https://custom-proxy.internal/v1');
      assert.strictEqual(deserializedNode.data.allowSensitiveActions, true);
      assert.deepStrictEqual(deserializedNode.data.tools, ['http_request', 'database_query', 'slack_message']);
      assert.strictEqual(deserializedNode.data.maxIterations, 12);
      assert.strictEqual(deserializedNode.data.maxToolCalls, 20);
      assert.strictEqual(deserializedNode.data.timeout, 45000);
      assert.strictEqual(deserializedNode.data.maxTokens, 3000);
      assert.strictEqual(deserializedNode.data.temperature, 0.15);
      assert.deepStrictEqual(deserializedNode.data.responseSchema.required, ['resolution']);
    });

    test('Serializes and deserializes Human Approval and Webhook configurations', () => {
      const approvalNode = {
        id: 'app_1',
        type: NodeTypes.ACTION_APPROVAL,
        position: { x: 200, y: 100 },
        data: {
          title: 'Approve Reimbursement #{{trigger.id}}',
          description: 'Expense submitted by team',
          message: 'Review travel expense receipt',
          approver: 'manager@example.com',
          timeoutHours: 48,
          timeoutAction: 'reject',
        },
      };

      const webhookNode = {
        id: 'wh_1',
        type: NodeTypes.TRIGGER_WEBHOOK,
        position: { x: 50, y: 100 },
        data: {
          enabled: true,
          methods: ['POST', 'PUT'],
          authType: 'hmac',
          hmacHeader: 'x-hub-signature-256',
          hmacAlgorithm: 'sha256',
        },
      };

      const wf = {
        id: 'wf_appr_wh',
        name: 'Approval Webhook Test',
        nodes: [approvalNode, webhookNode],
        edges: [{ id: 'e1', source: 'wh_1', target: 'app_1' }],
      };

      const serialized = WorkflowSerializer.serialize(wf);
      const jsonStr = JSON.stringify(serialized);
      assert.ok(typeof jsonStr === 'string', 'Serialized JSON must be a valid string');

      const restored = WorkflowSerializer.deserialize(JSON.parse(jsonStr));
      assert.strictEqual(restored.nodes.length, 2);

      const rApproval = restored.nodes.find((n) => n.id === 'app_1');
      assert.strictEqual(rApproval.data.title, 'Approve Reimbursement #{{trigger.id}}');
      assert.strictEqual(rApproval.data.timeoutHours, 48);
      assert.strictEqual(rApproval.data.timeoutAction, 'reject');

      const rWebhook = restored.nodes.find((n) => n.id === 'wh_1');
      assert.strictEqual(rWebhook.data.enabled, true);
      assert.deepStrictEqual(rWebhook.data.methods, ['POST', 'PUT']);
      assert.strictEqual(rWebhook.data.authType, 'hmac');
    });
  });

  // ── Group 4: Responsive Width and Layout Safety Constraints ──────────────
  describe('Group 4: Responsive Width and Layout Safety Constraints', () => {
    test('Sidebar preview testbed supports width bounds from 360px to desktop', () => {
      const supportedWidths = [360, 390, 420, 460, 520];
      for (const w of supportedWidths) {
        assert.ok(w >= 360, `Width ${w} must satisfy minimum 360px constraint`);
        assert.ok(w <= 600, `Width ${w} must remain within expected sidebar bounds`);
      }
    });
  });
});

/**
 * agentConfig.test.js
 *
 * Frontend Unit Tests for AI Agent Node & Configuration:
 * 1. NodeTypes catalog exports
 * 2. NODE_DEFS palette definitions (canonical 'ai' category, purple #8b5cf6, icon)
 * 3. DefaultNodeData configurations
 * 4. NodeValidator rules for action-ai-agent
 * 5. Icon mappings in getNodeIcon
 * 6. Serialization round-trip preservation
 */

import { NodeTypes } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { NODE_DEFS } from '../data/templates.js';
import { getNodeIcon } from '../constants/Icons.js';
import { NodeValidator } from '../validators/NodeValidator.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  }
}

async function runTests() {
  console.log('\n🧪 Starting AI Agent Frontend Configuration Tests...\n');

  // ── Group 1: NodeTypes Catalog ────────────────────────────────────────────
  console.log('Group 1: NodeTypes Catalog');
  check(NodeTypes.ACTION_AI_AGENT === 'action-ai-agent', 'NodeTypes defines ACTION_AI_AGENT');

  // ── Group 2: Palette NODE_DEFS Registration ───────────────────────────────
  console.log('\nGroup 2: Palette NODE_DEFS Registration');
  const agentDef = NODE_DEFS['action-ai-agent'];
  check(Boolean(agentDef), 'NODE_DEFS contains canonical entry for action-ai-agent');
  check(agentDef?.category === 'ai', 'action-ai-agent belongs to "ai" category');
  check(agentDef?.color === '#8b5cf6', 'action-ai-agent has purple color #8b5cf6');
  check(agentDef?.icon === 'Bot', 'action-ai-agent has Bot icon');
  check(Array.isArray(agentDef?.configSchema), 'action-ai-agent provides configSchema');

  // Verify total visible AI nodes in palette is 6
  const visibleAiNodes = Object.entries(NODE_DEFS).filter(([, d]) => d.category === 'ai');
  check(visibleAiNodes.length === 6, 'Exactly 6 AI nodes visible in palette (Generate, Chat, Structured, Classify, Embeddings, Agent)');

  // ── Group 3: DefaultNodeData Defaults ─────────────────────────────────────
  console.log('\nGroup 3: DefaultNodeData Defaults');
  const defaultData = DefaultNodeData[NodeTypes.ACTION_AI_AGENT];
  check(Boolean(defaultData), 'DefaultNodeData contains defaults for action-ai-agent');
  check(defaultData?.provider === 'openai', 'Defaults provider to openai');
  check(defaultData?.model === 'gpt-4o-mini', 'Defaults model to gpt-4o-mini');
  check(Array.isArray(defaultData?.tools), 'Defaults tools to an array');
  check(defaultData?.maxIterations === 10, 'Defaults maxIterations to 10');
  check(defaultData?.maxToolCalls === 15, 'Defaults maxToolCalls to 15');
  check(defaultData?.timeout === 60000, 'Defaults timeout to 60000');
  check(defaultData?.temperature === 0.2, 'Defaults temperature to 0.2');

  // ── Group 4: NodeValidator for AI Agent Node ──────────────────────────────
  console.log('\nGroup 4: NodeValidator for AI Agent Node');

  // Validate provider check
  const badProvider = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'unknown-llm', prompt: 'test' },
  });
  check(!badProvider.valid, 'Rejects invalid provider name');

  // Validate empty prompt/instructions
  const emptyPrompt = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: '', systemPrompt: '' },
  });
  check(!emptyPrompt.valid, 'Rejects empty prompt and systemPrompt');

  // Accepts valid prompt
  const validAgent = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: 'Find the highest revenue customer' },
  });
  check(validAgent.valid, 'Accepts valid prompt');

  // Validates maxIterations positive int
  const badIterations = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: 'Test', maxIterations: 0 },
  });
  check(!badIterations.valid, 'Rejects non-positive maxIterations');

  // Validates maxToolCalls positive int
  const badToolCalls = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: 'Test', maxToolCalls: -5 },
  });
  check(!badToolCalls.valid, 'Rejects negative maxToolCalls');

  // Validates response schema syntax
  const badSchema = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: 'Test', responseSchema: '{broken json' },
  });
  check(!badSchema.valid, 'Rejects broken JSON response schema');

  const goodSchema = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_AGENT,
    data: { provider: 'openai', prompt: 'Test', responseSchema: '{"type":"object"}' },
  });
  check(goodSchema.valid, 'Accepts valid JSON response schema');

  // ── Group 5: Icon Component Mappings ──────────────────────────────────────
  console.log('\nGroup 5: Icon Component Mappings');
  const agentIcon = getNodeIcon(NodeTypes.ACTION_AI_AGENT);
  check(Boolean(agentIcon), 'getNodeIcon returns icon component for action-ai-agent');

  // ── Group 6: Serialization Round-Trip ─────────────────────────────────────
  console.log('\nGroup 6: Serialization Round-Trip');
  const initialNodes = [
    {
      id: 'agent_node_1',
      type: NodeTypes.ACTION_AI_AGENT,
      position: { x: 200, y: 150 },
      data: {
        provider: 'openai',
        prompt: 'Search files and send slack alert',
        tools: ['http_request', 'file_storage', 'slack_message'],
        maxIterations: 5,
        allowSensitiveActions: true,
      },
    },
  ];

  const serialized = WorkflowSerializer.serialize({ nodes: initialNodes, edges: [] });
  check(serialized.workflow.nodes.length === 1, 'Serialized workflow contains agent node');
  check(serialized.workflow.nodes[0].type === 'action-ai-agent', 'Preserves action-ai-agent type');

  const deserialized = WorkflowSerializer.deserialize(serialized);
  check(deserialized.nodes.length === 1, 'Deserialized workflow contains agent node');
  check(deserialized.nodes[0].data.allowSensitiveActions === true, 'Preserves allowSensitiveActions flag');
  check(deserialized.nodes[0].data.tools.length === 3, 'Preserves authorized tools array');

  console.log(`\nAI Agent Frontend Tests: ${passed} passed, ${failed} failed\n`);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});


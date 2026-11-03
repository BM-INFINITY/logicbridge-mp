/**
 * aiConfig.test.js
 *
 * Frontend Unit Tests for AI / LLM Nodes & Provider Configuration:
 * 1. NodeTypes catalog exports
 * 2. NODE_DEFS palette definitions (canonical 'ai' category, purple #8b5cf6, icons)
 * 3. DefaultNodeData configurations
 * 4. NodeValidator rules for all 5 AI nodes
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
  console.log('\n🧪 Starting AI / LLM Frontend Configuration Tests...\n');

  // ── Group 1: NodeTypes Catalog ────────────────────────────────────────────
  console.log('Group 1: NodeTypes Catalog');
  check(NodeTypes.ACTION_AI_GENERATE === 'action-ai-generate', 'NodeTypes defines ACTION_AI_GENERATE');
  check(NodeTypes.ACTION_AI_CHAT === 'action-ai-chat', 'NodeTypes defines ACTION_AI_CHAT');
  check(NodeTypes.ACTION_AI_STRUCTURED === 'action-ai-structured', 'NodeTypes defines ACTION_AI_STRUCTURED');
  check(NodeTypes.ACTION_AI_CLASSIFY === 'action-ai-classify', 'NodeTypes defines ACTION_AI_CLASSIFY');
  check(NodeTypes.ACTION_AI_EMBEDDINGS === 'action-ai-embeddings', 'NodeTypes defines ACTION_AI_EMBEDDINGS');

  // ── Group 2: Palette NODE_DEFS Registration ───────────────────────────────
  console.log('\nGroup 2: Palette NODE_DEFS Registration');
  const aiTypes = [
    'action-ai-generate',
    'action-ai-chat',
    'action-ai-structured',
    'action-ai-classify',
    'action-ai-embeddings',
  ];

  aiTypes.forEach((type) => {
    const def = NODE_DEFS[type];
    check(Boolean(def), `NODE_DEFS contains canonical entry for ${type}`);
    check(def?.category === 'ai', `${type} belongs to 'ai' category`);
    check(def?.color === '#8b5cf6', `${type} has purple color '#8b5cf6'`);
    check(Array.isArray(def?.configSchema), `${type} provides configSchema`);
  });

  // Verify visible AI nodes in Object.entries(NODE_DEFS)
  const visibleAiNodes = Object.entries(NODE_DEFS).filter(([, d]) => d.category === 'ai');
  check(visibleAiNodes.length >= 5, 'AI nodes visible in palette');

  // ── Group 3: DefaultNodeData Defaults ─────────────────────────────────────
  console.log('\nGroup 3: DefaultNodeData Defaults');
  aiTypes.forEach((type) => {
    const defaultData = DefaultNodeData[type];
    check(Boolean(defaultData), `DefaultNodeData contains defaults for ${type}`);
    check(defaultData?.provider === 'openai', `${type} defaults provider to 'openai'`);
  });

  check(DefaultNodeData[NodeTypes.ACTION_AI_GENERATE].model === 'gpt-4o-mini', 'Generate defaults to gpt-4o-mini');
  check(DefaultNodeData[NodeTypes.ACTION_AI_STRUCTURED].schemaName === 'ResultOutput', 'Structured defaults schemaName');
  check(Array.isArray(DefaultNodeData[NodeTypes.ACTION_AI_CLASSIFY].categories), 'Classify defaults categories list');
  check(DefaultNodeData[NodeTypes.ACTION_AI_EMBEDDINGS].model === 'text-embedding-3-small', 'Embeddings defaults model');

  // ── Group 4: NodeValidator for AI Nodes ───────────────────────────────────
  console.log('\nGroup 4: NodeValidator for AI Nodes');

  // Validate provider check
  const badProvider = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_GENERATE,
    data: { provider: 'invalid-ai', prompt: 'test' },
  });
  check(!badProvider.valid, 'Rejects invalid provider name');
  check(badProvider.error.includes('Invalid AI provider'), 'Provides clear error for invalid provider');

  // Validate embeddings provider (Anthropic rejection)
  const anthropicEmbeddings = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_EMBEDDINGS,
    data: { provider: 'anthropic', input: 'test' },
  });
  check(!anthropicEmbeddings.valid, 'Rejects Anthropic for embeddings');
  check(anthropicEmbeddings.error.includes('Anthropic does not support embeddings'), 'Explains Anthropic limitation');

  // Validate AI Generate prompt
  const emptyGenerate = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_GENERATE,
    data: { provider: 'openai', prompt: '' },
  });
  check(!emptyGenerate.valid, 'Rejects empty prompt for AI Generate');

  const validGenerate = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_GENERATE,
    data: { provider: 'openai', prompt: 'Summarize {{steps.prev.text}}' },
  });
  check(validGenerate.valid, 'Accepts valid prompt for AI Generate');

  // Validate AI Chat
  const emptyChat = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_CHAT,
    data: { provider: 'openai', messages: [] },
  });
  check(!emptyChat.valid, 'Rejects empty messages for AI Chat');

  const validChat = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_CHAT,
    data: { provider: 'openai', messages: [{ role: 'user', content: 'Hello' }] },
  });
  check(validChat.valid, 'Accepts valid message in AI Chat');

  // Validate AI Structured Output
  const invalidSchema = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_STRUCTURED,
    data: { provider: 'openai', prompt: 'Extract', schema: '{invalid json' },
  });
  check(!invalidSchema.valid, 'Rejects invalid JSON schema syntax');

  const validStructured = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_STRUCTURED,
    data: { provider: 'openai', prompt: 'Extract', schema: '{"type":"object"}' },
  });
  check(validStructured.valid, 'Accepts valid JSON schema');

  // Validate AI Classification
  const notEnoughCats = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_CLASSIFY,
    data: { provider: 'openai', input: 'Some text', categories: ['One'] },
  });
  check(!notEnoughCats.valid, 'Rejects classification with fewer than two categories');

  const validClassify = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_CLASSIFY,
    data: { provider: 'openai', input: 'Some text', categories: ['Support', 'Sales'] },
  });
  check(validClassify.valid, 'Accepts valid classification with >= 2 categories');

  // Validate AI Embeddings
  const emptyEmbed = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_EMBEDDINGS,
    data: { provider: 'openai', input: '' },
  });
  check(!emptyEmbed.valid, 'Rejects empty input for AI Embeddings');

  const validEmbed = NodeValidator.validateNode({
    type: NodeTypes.ACTION_AI_EMBEDDINGS,
    data: { provider: 'openai', input: 'Semantic text' },
  });
  check(validEmbed.valid, 'Accepts valid input for AI Embeddings');

  // ── Group 5: Icon Component Mappings ──────────────────────────────────────
  console.log('\nGroup 5: Icon Component Mappings');
  aiTypes.forEach((type) => {
    const icon = getNodeIcon(type);
    check(Boolean(icon), `getNodeIcon returns icon component for ${type}`);
  });

  // ── Group 6: Serialization Round-Trip ─────────────────────────────────────
  console.log('\nGroup 6: Serialization Round-Trip');
  const initialNodes = [
    {
      id: 'ai-gen-node',
      type: NodeTypes.ACTION_AI_GENERATE,
      position: { x: 100, y: 150 },
      data: { provider: 'openai', prompt: 'Test' },
    },
    {
      id: 'ai-chat-node',
      type: NodeTypes.ACTION_AI_CHAT,
      position: { x: 300, y: 150 },
      data: { provider: 'anthropic', messages: [{ role: 'user', content: 'Hi' }] },
    },
  ];

  const serialized = WorkflowSerializer.serialize({ nodes: initialNodes, edges: [] });
  check(serialized.workflow.nodes.length === 2, 'Serialized workflow preserves both AI nodes');
  check(serialized.workflow.nodes[0].type === 'action-ai-generate', 'Preserves action-ai-generate type');
  check(serialized.workflow.nodes[1].type === 'action-ai-chat', 'Preserves action-ai-chat type');

  const deserialized = WorkflowSerializer.deserialize(serialized);
  check(deserialized.nodes.length === 2, 'Deserialized workflow preserves both AI nodes');
  check(deserialized.nodes[0].data.prompt === 'Test', 'Preserves prompt configuration');

  console.log(`\nAI Frontend Tests: ${passed} passed, ${failed} failed\n`);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});

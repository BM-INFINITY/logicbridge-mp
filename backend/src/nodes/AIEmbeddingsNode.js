const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIEmbeddingsNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_EMBEDDINGS,
      name: 'AI Embeddings',
      description: 'Generate high-dimensional vector embeddings from text for semantic search and retrieval',
      icon: 'Brain',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    if (!data.input && !data.text) {
      return { valid: false, error: 'Input text is required for AI Embeddings' };
    }
    const provider = String(data.provider || 'openai').toLowerCase().trim();
    if (provider === 'anthropic') {
      return {
        valid: false,
        error: 'Anthropic does not support embeddings. Please choose OpenAI, OpenRouter, or Ollama.',
      };
    }
    return { valid: true };
  }

  async execute(node, context, options = {}) {
    const startTime = Date.now();
    const data = node?.data || {};

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const config = await this.resolveConfig(node, context);
    const rawInput = data.input !== undefined ? data.input : data.text;
    const resolvedInput = resolveVariable(rawInput, context);

    const httpClient = options.httpClient || context?.httpClient || undefined;

    const result = await config.provider.embeddings({
      input: resolvedInput,
      model: config.model,
      dimensions: data.dimensions,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      httpClient,
    });

    return this.formatOutput(result, startTime);
  }
}

module.exports = AIEmbeddingsNode;


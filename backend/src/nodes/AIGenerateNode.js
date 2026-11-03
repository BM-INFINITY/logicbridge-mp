const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIGenerateNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_GENERATE,
      name: 'AI Generate',
      description: 'Generate text completions from dynamic prompt templates using an LLM',
      icon: 'Sparkles',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    if (!data.prompt || !String(data.prompt).trim()) {
      return { valid: false, error: 'Prompt template is required for AI Generate' };
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
    const rawPrompt = data.prompt || '';
    const resolvedPrompt = resolveVariable(rawPrompt, context);

    const rawSystem = data.systemPrompt || '';
    const resolvedSystem = rawSystem ? resolveVariable(rawSystem, context) : undefined;

    const httpClient = options.httpClient || context?.httpClient || undefined;

    const result = await config.provider.generate({
      prompt: resolvedPrompt,
      systemPrompt: resolvedSystem,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      stop: config.stop,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      httpClient,
    });

    return this.formatOutput(result, startTime);
  }
}

module.exports = AIGenerateNode;


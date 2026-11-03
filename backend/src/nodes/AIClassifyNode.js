const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIClassifyNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_CLASSIFY,
      name: 'AI Classification',
      description: 'Classify text input into one of several predefined target categories',
      icon: 'Tag',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    if (!data.input && !data.text) {
      return { valid: false, error: 'Input text is required for AI Classification' };
    }
    let cats = data.categories;
    if (typeof cats === 'string') {
      cats = cats.split(',').map((c) => c.trim()).filter(Boolean);
    }
    if (!Array.isArray(cats) || cats.length < 2) {
      return { valid: false, error: 'At least two categories are required for AI Classification' };
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

    let targetCategories = data.categories;
    if (typeof targetCategories === 'string') {
      const resolvedCatsStr = resolveVariable(targetCategories, context);
      targetCategories = resolvedCatsStr.split(',').map((c) => c.trim()).filter(Boolean);
    } else if (Array.isArray(targetCategories)) {
      targetCategories = targetCategories.map((c) => resolveVariable(String(c), context).trim()).filter(Boolean);
    }

    const resolvedSystem = data.systemPrompt ? resolveVariable(data.systemPrompt, context) : undefined;
    const httpClient = options.httpClient || context?.httpClient || undefined;

    const result = await config.provider.classify({
      input: resolvedInput,
      categories: targetCategories,
      systemPrompt: resolvedSystem,
      model: config.model,
      temperature: config.temperature ?? 0,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      httpClient,
    });

    return this.formatOutput(result, startTime);
  }
}

module.exports = AIClassifyNode;


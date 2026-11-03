const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIChatNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_CHAT,
      name: 'AI Chat',
      description: 'Conversational chat with multi-turn messages and system context',
      icon: 'MessageSquare',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    const hasMessages =
      Array.isArray(data.messages) &&
      data.messages.length > 0 &&
      data.messages.some((m) => String(m.content || '').trim().length > 0);
    const hasPrompt = Boolean(data.prompt && String(data.prompt).trim());

    if (!hasMessages && !hasPrompt) {
      return { valid: false, error: 'At least one message or prompt is required for AI Chat' };
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

    // Resolve system prompt
    const rawSystem = data.systemPrompt || '';
    const resolvedSystem = rawSystem ? resolveVariable(rawSystem, context) : undefined;

    // Resolve messages list
    let inputMessages = [];
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      inputMessages = data.messages.map((m) => ({
        role: m.role || 'user',
        content: resolveVariable(String(m.content || ''), context),
      }));
    } else if (data.prompt) {
      inputMessages = [
        {
          role: 'user',
          content: resolveVariable(String(data.prompt), context),
        },
      ];
    }

    const httpClient = options.httpClient || context?.httpClient || undefined;

    const result = await config.provider.chat({
      messages: inputMessages,
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

    // Provide complete conversation history including assistant response
    const conversation = [
      ...inputMessages,
      { role: 'assistant', content: result.text },
    ];

    return this.formatOutput(
      {
        ...result,
        messages: conversation,
      },
      startTime
    );
  }
}

module.exports = AIChatNode;


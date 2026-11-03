const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const { AgentExecutor } = require('../agents');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIAgentNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_AGENT,
      name: 'AI Agent',
      description: 'Autonomous AI Agent capable of multi-step reasoning and dynamic tool calling',
      icon: 'Bot',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    if (!data.prompt && !data.systemPrompt) {
      return { valid: false, error: 'User prompt or instructions are required for AI Agent' };
    }

    if (data.maxIterations !== undefined && data.maxIterations !== null && data.maxIterations !== '') {
      const it = parseInt(data.maxIterations, 10);
      if (isNaN(it) || it < 1) {
        return { valid: false, error: 'Max iterations must be a positive integer' };
      }
    }

    if (data.maxToolCalls !== undefined && data.maxToolCalls !== null && data.maxToolCalls !== '') {
      const tc = parseInt(data.maxToolCalls, 10);
      if (isNaN(tc) || tc < 1) {
        return { valid: false, error: 'Max tool calls must be a positive integer' };
      }
    }

    if (data.responseSchema) {
      if (typeof data.responseSchema === 'string' && data.responseSchema.trim()) {
        try {
          JSON.parse(data.responseSchema);
        } catch (err) {
          return { valid: false, error: `Invalid response schema JSON: ${err.message}` };
        }
      }
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
    const resolvedPrompt = resolveVariable(data.prompt || data.task || '', context);
    const resolvedSystem = data.systemPrompt ? resolveVariable(data.systemPrompt, context) : undefined;

    let parsedSchema = data.responseSchema || null;
    if (typeof data.responseSchema === 'string' && data.responseSchema.trim()) {
      try {
        parsedSchema = JSON.parse(resolveVariable(data.responseSchema, context));
      } catch (err) {
        throw new NodeExecutionError(`Invalid response schema: ${err.message}`);
      }
    }

    const httpClient = options.httpClient || context?.httpClient || undefined;

    const agentResult = await AgentExecutor.execute({
      provider: config.provider,
      prompt: resolvedPrompt,
      systemPrompt: resolvedSystem,
      tools: Array.isArray(data.tools) ? data.tools : [],
      model: config.model,
      maxIterations: data.maxIterations,
      maxToolCalls: data.maxToolCalls,
      timeout: config.timeout,
      allowSensitiveActions: Boolean(data.allowSensitiveActions),
      responseSchema: parsedSchema,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      executionContext: context,
      httpClient,
    });

    return this.formatOutput(agentResult.toJSON(), startTime);
  }
}

module.exports = AIAgentNode;


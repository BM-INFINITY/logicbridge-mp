const BaseAINode = require('./BaseAINode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils/variableResolver');
const NodeExecutionError = require('../errors/NodeExecutionError');

class AIStructuredOutputNode extends BaseAINode {
  constructor() {
    super({
      type: NodeTypes.ACTION_AI_STRUCTURED,
      name: 'AI Structured Output',
      description: 'Generate strictly validated structured JSON output matching a defined schema',
      icon: 'Braces',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    if (!data.prompt || !String(data.prompt).trim()) {
      return { valid: false, error: 'Prompt is required for AI Structured Output' };
    }
    if (!data.schema || !String(data.schema).trim()) {
      return { valid: false, error: 'JSON Schema is required for AI Structured Output' };
    }
    if (typeof data.schema === 'string') {
      try {
        JSON.parse(data.schema);
      } catch (err) {
        return { valid: false, error: `Invalid JSON Schema syntax: ${err.message}` };
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
    const resolvedPrompt = resolveVariable(data.prompt, context);
    const resolvedSystem = data.systemPrompt ? resolveVariable(data.systemPrompt, context) : undefined;

    let parsedSchema = data.schema;
    if (typeof data.schema === 'string') {
      const resolvedSchemaStr = resolveVariable(data.schema, context);
      try {
        parsedSchema = JSON.parse(resolvedSchemaStr);
      } catch (err) {
        throw new NodeExecutionError(`Invalid JSON Schema: ${err.message}`, {
          nodeId: node.id,
          nodeType: this.type,
        });
      }
    }

    const httpClient = options.httpClient || context?.httpClient || undefined;

    const result = await config.provider.structuredOutput({
      prompt: resolvedPrompt,
      schema: parsedSchema,
      schemaName: data.schemaName || 'StructuredResult',
      systemPrompt: resolvedSystem,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      httpClient,
    });

    return this.formatOutput(result, startTime);
  }
}

module.exports = AIStructuredOutputNode;


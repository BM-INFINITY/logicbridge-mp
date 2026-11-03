const BaseNode = require('./BaseNode');
const { resolveVariable } = require('../utils/variableResolver');
const { registerActiveSecrets } = require('../utils/secretRedactor');
const { providerRegistry } = require('../providers/llm');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * BaseAINode — Foundation for all AI/LLM workflow nodes in LogicBridge
 */
class BaseAINode extends BaseNode {
  constructor({ type, name, description, icon = 'Sparkles', version = '1.0.0' }) {
    super({
      type,
      name,
      category: 'ai',
      icon,
      description,
      version,
    });
  }

  /**
   * Resolves credentials, provider instance, and endpoint configuration
   * @param {object} node - React Flow node instance
   * @param {object} context - ExecutionContext or context object
   * @returns {Promise<object>}
   */
  async resolveConfig(node, context) {
    const data = node?.data || {};
    const providerId = String(data.provider || 'openai').toLowerCase().trim();
    const provider = providerRegistry.getProvider(providerId);

    let apiKey = data.apiKey ? String(data.apiKey).trim() : '';
    let baseUrl = data.baseUrl ? String(data.baseUrl).trim() : '';
    let model = data.model ? String(data.model).trim() : '';

    // 1. Resolve from connection if connectionId is provided
    if (data.connectionId) {
      const ownerId =
        context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
      try {
        const credentials = await ConnectionService.getDecryptedCredentials(data.connectionId, ownerId);
        if (credentials.apiKey || credentials.token) {
          apiKey = credentials.apiKey || credentials.token;
        }
        if (credentials.baseUrl) {
          baseUrl = credentials.baseUrl;
        }
        if (credentials.model && !model) {
          model = credentials.model;
        }
      } catch (err) {
        throw new NodeExecutionError(
          `Failed to load LLM connection (${data.connectionId}): ${err.message}`,
          { nodeId: node.id, nodeType: this.type, originalError: err }
        );
      }
    }

    // 2. Resolve dynamic expressions in apiKey, baseUrl, and model
    if (apiKey) {
      apiKey = resolveVariable(apiKey, context);
    }
    if (baseUrl) {
      baseUrl = resolveVariable(baseUrl, context);
    }
    if (model) {
      model = resolveVariable(model, context);
    }

    // 3. For non-local providers, require an API key
    if (providerId !== 'ollama' && (!apiKey || !String(apiKey).trim())) {
      throw new NodeExecutionError(
        `API key is required for provider "${provider.name}". Please provide a connection or an API key (e.g. {{secrets.OPENAI_API_KEY}}).`,
        { nodeId: node.id, nodeType: this.type }
      );
    }

    // 4. Register API key with SecretRedactor for automatic masking
    if (apiKey && typeof apiKey === 'string' && apiKey.length >= 3) {
      registerActiveSecrets([apiKey], context?.executionId);
    }

    return {
      provider,
      providerId,
      apiKey,
      baseUrl: baseUrl || undefined,
      model: model || undefined,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      topP: data.topP,
      stop: data.stop,
      timeout: parseInt(data.timeout, 10) || 30000,
    };
  }

  /**
   * Helper to format standardized response
   */
  formatOutput(rawResult, startTime) {
    const executionTimeMs = Date.now() - startTime;
    return {
      ...rawResult,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = BaseAINode;


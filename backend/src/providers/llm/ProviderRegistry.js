const { ConfigurationError } = require('../../errors');
const OpenAIProvider = require('./OpenAIProvider');
const OpenRouterProvider = require('./OpenRouterProvider');
const AnthropicProvider = require('./AnthropicProvider');
const OllamaProvider = require('./OllamaProvider');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.registerProvider('openai', new OpenAIProvider());
    this.registerProvider('openrouter', new OpenRouterProvider());
    this.registerProvider('anthropic', new AnthropicProvider());
    this.registerProvider('ollama', new OllamaProvider());
  }

  /**
   * Registers a provider instance
   * @param {string} id
   * @param {object} providerInstance
   */
  registerProvider(id, providerInstance) {
    if (!id || typeof id !== 'string') {
      throw new ConfigurationError('Provider registration requires a string id');
    }
    if (!providerInstance) {
      throw new ConfigurationError('Cannot register null or undefined provider instance');
    }
    this.providers.set(id.toLowerCase().trim(), providerInstance);
  }

  /**
   * Resolves a provider instance by id
   * @param {string} id
   * @returns {object}
   */
  getProvider(id = 'openai') {
    const key = String(id || 'openai').toLowerCase().trim();
    const provider = this.providers.get(key);
    if (!provider) {
      const supported = Array.from(this.providers.keys()).join(', ');
      throw new ConfigurationError(`Unknown LLM provider "${id}". Supported providers: ${supported}`);
    }
    return provider;
  }

  /**
   * Checks if a provider id is registered
   * @param {string} id
   * @returns {boolean}
   */
  hasProvider(id) {
    if (!id) return false;
    return this.providers.has(String(id).toLowerCase().trim());
  }

  /**
   * Lists metadata for all registered providers
   * @returns {Array<object>}
   */
  listProviders() {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      defaultBaseUrl: p.defaultBaseUrl,
      capabilities: Array.from(p.capabilities || []),
      defaultModels: p.defaultModels || {},
    }));
  }
}

// Export singleton instance
const providerRegistry = new ProviderRegistry();

module.exports = {
  ProviderRegistry,
  providerRegistry,
};


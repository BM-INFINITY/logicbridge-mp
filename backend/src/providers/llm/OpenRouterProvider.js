const OpenAIProvider = require('./OpenAIProvider');

class OpenRouterProvider extends OpenAIProvider {
  constructor(options = {}) {
    super({
      id: options.id || 'openrouter',
      name: options.name || 'OpenRouter',
      defaultBaseUrl: options.defaultBaseUrl || 'https://openrouter.ai/api/v1',
      capabilities: options.capabilities || ['generate', 'chat', 'structured', 'classify', 'embeddings'],
      defaultModels: options.defaultModels || {
        chat: 'openai/gpt-4o-mini',
        generate: 'openai/gpt-4o-mini',
        structured: 'openai/gpt-4o-mini',
        classify: 'openai/gpt-4o-mini',
        embeddings: 'openai/text-embedding-3-small',
      },
      customHeaders: {
        'HTTP-Referer': 'https://logicbridge.io',
        'X-Title': 'LogicBridge',
        ...(options.customHeaders || {}),
      },
    });
  }
}

module.exports = OpenRouterProvider;


const axios = require('axios');
const { ConfigurationError, NodeExecutionError } = require('../../errors');

/**
 * Standard LLM Error class
 */
class LLMError extends Error {
  constructor(message, { provider, statusCode, code, retryAfterSec, originalError } = {}) {
    super(message);
    this.name = 'LLMError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.originalError = originalError;
  }
}

/**
 * Abstract Base LLM Provider class
 */
class LLMProvider {
  /**
   * @param {object} options
   * @param {string} options.id - Provider unique ID ('openai', 'anthropic', etc.)
   * @param {string} options.name - Human-readable name
   * @param {string} options.defaultBaseUrl - Default base API endpoint
   * @param {Array<string>} options.capabilities - Supported capabilities list
   * @param {object} [options.defaultModels] - Map of capability -> default model
   */
  constructor({ id, name, defaultBaseUrl, capabilities = [], defaultModels = {} }) {
    if (!id || !name) {
      throw new ConfigurationError('LLMProvider requires "id" and "name"');
    }
    this.id = id;
    this.name = name;
    this.defaultBaseUrl = defaultBaseUrl || '';
    this.capabilities = new Set(capabilities);
    this.defaultModels = defaultModels;
  }

  /**
   * Checks if provider supports a given capability
   * @param {string} capability
   * @returns {boolean}
   */
  supports(capability) {
    return this.capabilities.has(capability);
  }

  /**
   * Validates if provider supports capability; throws if not
   * @param {string} capability
   */
  validateCapability(capability) {
    if (!this.supports(capability)) {
      throw new NodeExecutionError(
        `Provider "${this.name}" does not support capability "${capability}". Supported: ${Array.from(this.capabilities).join(', ')}`
      );
    }
  }

  /**
   * Normalizes provider-specific API errors into a consistent LLMError
   * @param {any} err
   * @returns {LLMError}
   */
  normalizeError(err) {
    if (err instanceof LLMError) return err;

    const statusCode = err.response?.status || (err.code === 'ECONNABORTED' ? 408 : null);
    const retryAfterSec = err.response?.headers?.['retry-after']
      ? parseInt(err.response.headers['retry-after'], 10)
      : null;

    let message = err.message || 'Unknown LLM provider error';
    const errData = err.response?.data;

    if (errData) {
      if (typeof errData === 'string') {
        message = errData;
      } else if (errData.error?.message) {
        message = errData.error.message;
      } else if (errData.error && typeof errData.error === 'string') {
        message = errData.error;
      } else if (errData.message) {
        message = errData.message;
      }
    }

    if (statusCode === 401) {
      message = `Authentication failed (${this.name}): ${message}`;
    } else if (statusCode === 429) {
      message = `Rate limit exceeded (${this.name}): ${message}${retryAfterSec ? ` (Retry after ${retryAfterSec}s)` : ''}`;
    } else if (statusCode === 404) {
      message = `Model or endpoint not found (${this.name}): ${message}`;
    } else if (err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout')) {
      message = `Request timed out (${this.name})`;
    }

    return new LLMError(message, {
      provider: this.id,
      statusCode,
      code: err.code,
      retryAfterSec: isNaN(retryAfterSec) ? null : retryAfterSec,
      originalError: err,
    });
  }

  /**
   * Executes an async API request with automatic rate limit (HTTP 429) retry and exponential backoff
   * @param {Function} apiCallFn
   * @param {object} [options]
   * @param {number} [options.maxRetries=3]
   * @param {number} [options.initialDelayMs=300]
   * @param {number} [options.maxDelayMs=3000]
   * @returns {Promise<any>}
   */
  async executeWithRetry(apiCallFn, { maxRetries = 3, initialDelayMs = 300, maxDelayMs = 3000 } = {}) {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        return await apiCallFn();
      } catch (err) {
        const normalized = this.normalizeError(err);
        const isRateLimit = normalized.statusCode === 429;
        const isTransient = isRateLimit || normalized.statusCode === 503 || normalized.statusCode === 502;

        if (isTransient && attempt < maxRetries) {
          const waitTime = normalized.retryAfterSec
            ? Math.min(normalized.retryAfterSec * 1000, maxDelayMs)
            : Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50);

          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        throw normalized;
      }
    }
  }

  /**
   * Text Generation
   */
  async generate(options) {
    throw new Error(`generate() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Conversational Chat
   */
  async chat(options) {
    throw new Error(`chat() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Structured JSON Output
   */
  async structuredOutput(options) {
    throw new Error(`structuredOutput() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Classification
   */
  async classify(options) {
    throw new Error(`classify() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Vector Embeddings
   */
  async embeddings(options) {
    throw new Error(`embeddings() must be implemented by ${this.constructor.name}`);
  }
}

module.exports = {
  LLMProvider,
  LLMError,
};


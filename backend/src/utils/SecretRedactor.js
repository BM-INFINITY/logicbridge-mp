/**
 * SecretRedactor — redacts sensitive headers, auth tokens, keys, and passwords
 * in execution step inputs/outputs and logs to prevent credential leakage.
 *
 * Concurrency Hardened (Iteration 31):
 * Uses AsyncLocalStorage and execution-scoped RedactionScope instances to ensure
 * parallel workflow executions do not share, leak, or prematurely clear each other's active secrets.
 */

const { AsyncLocalStorage } = require('node:async_hooks');

const SENSITIVE_KEYS_REGEX = /^(authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|x-api-key|(?:access[-_]?|refresh[-_]?|id[-_]?)?token|bearer|password|secret|pass|client[-_]?secret|credentials|connectionstring|databaseurl|mongouri|dburl|webhook[-_]?url|bot[-_]?token|slack[-_]?token|discord[-_]?token|secretaccesskey|accesskeyid|aws[-_]?secret[-_]?access[-_]?key|aws[-_]?access[-_]?key[-_]?id|sessiontoken|aws[-_]?session[-_]?token|securitytoken)$/i;

const DB_URI_REGEX = /((?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^:\s]+:)[^@\s]+(@[^\s]+)/gi;
const DISCORD_WEBHOOK_REGEX = /(https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/gi;
const SLACK_WEBHOOK_REGEX = /(https?:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/)[A-Za-z0-9_-]+/gi;
const SLACK_TOKEN_REGEX = /xox[baprs]-[A-Za-z0-9-]+/g;
const AWS_ACCESS_KEY_REGEX = /\b(AKIA|ASIA|AROA)[0-9A-Z]{16}\b/g;
const AWS_SIGNATURE_REGEX = /(Signature=)[0-9a-fA-F]{64}/gi;
const AWS_SIGNED_URL_REGEX = /(X-Amz-(?:Signature|Security-Token)=)[^&\s]+/gi;
const OPENAI_KEY_REGEX = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
const ANTHROPIC_KEY_REGEX = /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g;

/**
 * Isolated redaction scope for an individual workflow execution.
 */
class RedactionScope {
  constructor(id = null) {
    this.id = id || Math.random().toString(36).substring(2, 10);
    this.secretValues = new Set();
    this.secretKeys = new Set();
  }

  /**
   * Registers active secret values and keys into this scope.
   * @param {Array<string>|object} secrets
   */
  register(secrets) {
    if (!secrets) return;
    if (Array.isArray(secrets)) {
      for (const val of secrets) {
        if (typeof val === 'string' && val.trim().length >= 3) {
          this.secretValues.add(val.trim());
        }
      }
    } else if (typeof secrets === 'object') {
      for (const [key, val] of Object.entries(secrets)) {
        if (key && typeof key === 'string') {
          this.secretKeys.add(key.toLowerCase().trim());
        }
        if (typeof val === 'string' && val.trim().length >= 3) {
          this.secretValues.add(val.trim());
        }
      }
    }
  }

  /**
   * Clears registered secrets in this scope.
   */
  clear() {
    this.secretValues.clear();
    this.secretKeys.clear();
  }

  get size() {
    return this.secretValues.size + this.secretKeys.size;
  }
}

// AsyncLocalStorage for execution-scoped isolation across async call stacks
const executionScopeStorage = new AsyncLocalStorage();

// Fallback scope for global/standalone test usage
const globalScope = new RedactionScope('global');

// Explicit execution-keyed registry for out-of-band lookups
const executionRegistry = new Map();

/**
 * Resolves the currently active RedactionScope.
 */
function getActiveScope(options = null) {
  if (options && options.scope instanceof RedactionScope) {
    return options.scope;
  }
  if (options && options.executionId && executionRegistry.has(options.executionId)) {
    return executionRegistry.get(options.executionId);
  }
  const asyncScope = executionScopeStorage.getStore();
  if (asyncScope) {
    return asyncScope;
  }
  return globalScope;
}

/**
 * Runs a function within an isolated RedactionScope.
 * All async operations within the callback inherit this scope.
 *
 * @param {Array<string>|object|RedactionScope} secretsOrScope
 * @param {Function} fn - Sync or async function to execute
 * @param {string} [executionId] - Optional execution ID for explicit lookup
 * @returns {any} Result of fn
 */
function runWithScope(secretsOrScope, fn, executionId = null) {
  let scope;
  if (secretsOrScope instanceof RedactionScope) {
    scope = secretsOrScope;
  } else {
    scope = new RedactionScope(executionId);
    if (secretsOrScope) scope.register(secretsOrScope);
  }

  if (executionId) {
    executionRegistry.set(executionId, scope);
  }

  const cleanup = () => {
    if (executionId) {
      executionRegistry.delete(executionId);
    }
    scope.clear();
  };

  try {
    const result = executionScopeStorage.run(scope, () => fn(scope));
    if (result && typeof result.then === 'function') {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (err) {
    cleanup();
    throw err;
  }
}

/**
 * Registers active secret values and keys for runtime redaction.
 * Modifies the current async execution scope if available, or the global fallback.
 * @param {Array<string>|object} secrets
 * @param {string} [executionId]
 */
function registerActiveSecrets(secrets, executionId = null) {
  if (executionId) {
    let scope = executionRegistry.get(executionId);
    if (!scope) {
      scope = new RedactionScope(executionId);
      executionRegistry.set(executionId, scope);
    }
    scope.register(secrets);
    return scope;
  }

  const scope = executionScopeStorage.getStore() || globalScope;
  scope.register(secrets);
  return scope;
}

/**
 * Clears registered active secrets for the current async scope or global fallback.
 * @param {string} [executionId]
 */
function clearActiveSecrets(executionId = null) {
  if (executionId) {
    const scope = executionRegistry.get(executionId);
    if (scope) {
      scope.clear();
      executionRegistry.delete(executionId);
    }
    return;
  }

  const scope = executionScopeStorage.getStore() || globalScope;
  scope.clear();
}

/**
 * Redacts database URIs, webhook URLs, and active registered secret values from strings.
 * Respects the active execution scope and optional extra secret values.
 */
function redactUriString(str, extraSecretValues = null, scopeOverride = null) {
  if (typeof str !== 'string') return str;
  let result = str
    .replace(DB_URI_REGEX, '$1[REDACTED]$2')
    .replace(DISCORD_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_TOKEN_REGEX, '[REDACTED]')
    .replace(AWS_ACCESS_KEY_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNATURE_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNED_URL_REGEX, '$1[REDACTED]')
    .replace(OPENAI_KEY_REGEX, '[REDACTED]')
    .replace(ANTHROPIC_KEY_REGEX, '[REDACTED]');

  // Determine active scope
  const activeScope = scopeOverride || getActiveScope();
  const allSecretValues = new Set(activeScope.secretValues);

  // If in a non-global execution scope, also check globalScope only if globalScope has items
  if (activeScope !== globalScope && globalScope.secretValues.size > 0) {
    for (const s of globalScope.secretValues) {
      allSecretValues.add(s);
    }
  }

  if (Array.isArray(extraSecretValues)) {
    extraSecretValues.forEach((s) => {
      if (typeof s === 'string' && s.trim().length >= 3) allSecretValues.add(s.trim());
    });
  }

  if (allSecretValues.size > 0) {
    for (const secretVal of allSecretValues) {
      if (result.includes(secretVal)) {
        const escaped = secretVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), '[REDACTED]');
      }
    }
  }

  return result;
}

/**
 * Recursively redacts sensitive values from an object or array.
 * Concurrency-safe: reads from the current async execution scope.
 *
 * @param {any} data - Input object, array, or primitive
 * @param {Array<string>|object} [additionalSecrets] - Optional extra secrets to redact
 * @param {object} [options] - Optional options with { executionId, scope }
 * @returns {any} - Deep copy with sensitive fields replaced with '[REDACTED]'
 */
function redactSecrets(data, additionalSecrets = null, options = null) {
  if (data === null || data === undefined) return data;

  const activeScope = getActiveScope(options);

  let extraSecretValues = null;
  const extraSecretKeys = new Set();
  if (additionalSecrets) {
    if (Array.isArray(additionalSecrets)) {
      extraSecretValues = additionalSecrets;
    } else if (typeof additionalSecrets === 'object') {
      extraSecretValues = Object.values(additionalSecrets);
      Object.keys(additionalSecrets).forEach((k) => extraSecretKeys.add(k.toLowerCase().trim()));
    }
  }

  if (typeof data === 'string') return redactUriString(data, extraSecretValues, activeScope);
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSecrets(item, additionalSecrets, options));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive =
      SENSITIVE_KEYS_REGEX.test(key) ||
      activeScope.secretKeys.has(key.toLowerCase()) ||
      (activeScope !== globalScope && globalScope.secretKeys.has(key.toLowerCase())) ||
      extraSecretKeys.has(key.toLowerCase());

    if (isSensitive) {
      if (typeof value === 'string' && /^Bearer\s+/i.test(value)) {
        redacted[key] = 'Bearer [REDACTED]';
      } else if (typeof value === 'string' && /^Basic\s+/i.test(value)) {
        redacted[key] = 'Basic [REDACTED]';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof value === 'string' && /^Bearer\s+/i.test(value)) {
      redacted[key] = 'Bearer [REDACTED]';
    } else if (typeof value === 'string' && /^Basic\s+/i.test(value)) {
      redacted[key] = 'Basic [REDACTED]';
    } else if (typeof value === 'string') {
      redacted[key] = redactUriString(value, extraSecretValues, activeScope);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSecrets(value, additionalSecrets, options);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

module.exports = {
  RedactionScope,
  redactSecrets,
  redact: redactSecrets,
  redactUriString,
  registerActiveSecrets,
  clearActiveSecrets,
  runWithScope,
  getActiveScope,
};

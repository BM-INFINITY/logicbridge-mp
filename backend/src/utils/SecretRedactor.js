/**
 * SecretRedactor — redacts sensitive headers, auth tokens, keys, and passwords
 * in execution step inputs/outputs and logs to prevent credential leakage.
 */

const SENSITIVE_KEYS_REGEX = /^(authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|x-api-key|(?:access[-_]?|refresh[-_]?|id[-_]?)?token|bearer|password|secret|pass|client[-_]?secret|credentials|connectionstring|databaseurl|mongouri|dburl|webhook[-_]?url|bot[-_]?token|slack[-_]?token|discord[-_]?token|secretaccesskey|accesskeyid|aws[-_]?secret[-_]?access[-_]?key|aws[-_]?access[-_]?key[-_]?id|sessiontoken|aws[-_]?session[-_]?token|securitytoken)$/i;

const DB_URI_REGEX = /((?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^:\s]+:)[^@\s]+(@[^\s]+)/gi;
const DISCORD_WEBHOOK_REGEX = /(https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/gi;
const SLACK_WEBHOOK_REGEX = /(https?:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/)[A-Za-z0-9_-]+/gi;
const SLACK_TOKEN_REGEX = /xox[baprs]-[A-Za-z0-9-]+/g;
const AWS_ACCESS_KEY_REGEX = /\b(AKIA|ASIA|AROA)[0-9A-Z]{16}\b/g;
const AWS_SIGNATURE_REGEX = /(Signature=)[0-9a-fA-F]{64}/gi;
const AWS_SIGNED_URL_REGEX = /(X-Amz-(?:Signature|Security-Token)=)[^&\s]+/gi;

// Active workflow secrets registered during execution
const activeSecretValues = new Set();
const activeSecretKeys = new Set();

/**
 * Registers active secret values and keys for runtime redaction.
 * @param {Array<string>|object} secrets
 */
function registerActiveSecrets(secrets) {
  if (!secrets) return;
  if (Array.isArray(secrets)) {
    for (const val of secrets) {
      if (typeof val === 'string' && val.trim().length >= 3) {
        activeSecretValues.add(val.trim());
      }
    }
  } else if (typeof secrets === 'object') {
    for (const [key, val] of Object.entries(secrets)) {
      if (key && typeof key === 'string') {
        activeSecretKeys.add(key.toLowerCase().trim());
      }
      if (typeof val === 'string' && val.trim().length >= 3) {
        activeSecretValues.add(val.trim());
      }
    }
  }
}

/**
 * Clears registered active secrets
 */
function clearActiveSecrets() {
  activeSecretValues.clear();
  activeSecretKeys.clear();
}

/**
 * Redacts database URIs, webhook URLs, and active registered secret values from strings
 */
function redactUriString(str, extraSecretValues = null) {
  if (typeof str !== 'string') return str;
  let result = str
    .replace(DB_URI_REGEX, '$1[REDACTED]$2')
    .replace(DISCORD_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_TOKEN_REGEX, '[REDACTED]')
    .replace(AWS_ACCESS_KEY_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNATURE_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNED_URL_REGEX, '$1[REDACTED]');

  // Redact active registered secrets
  const allSecretValues = new Set(activeSecretValues);
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
 * @param {any} data - Input object, array, or primitive
 * @param {Array<string>|object} [additionalSecrets] - Optional extra secrets to redact
 * @returns {any} - Deep copy with sensitive fields replaced with '[REDACTED]'
 */
function redactSecrets(data, additionalSecrets = null) {
  if (data === null || data === undefined) return data;

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

  if (typeof data === 'string') return redactUriString(data, extraSecretValues);
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSecrets(item, additionalSecrets));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive =
      SENSITIVE_KEYS_REGEX.test(key) ||
      activeSecretKeys.has(key.toLowerCase()) ||
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
      redacted[key] = redactUriString(value, extraSecretValues);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSecrets(value, additionalSecrets);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

module.exports = {
  redactSecrets,
  redact: redactSecrets,
  redactUriString,
  registerActiveSecrets,
  clearActiveSecrets,
};

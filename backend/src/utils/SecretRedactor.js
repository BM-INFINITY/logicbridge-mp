/**
 * SecretRedactor — redacts sensitive headers, auth tokens, keys, and passwords
 * in execution step inputs/outputs and logs to prevent credential leakage.
 */

const SENSITIVE_KEYS_REGEX = /^(authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|x-api-key|token|bearer|password|secret|pass|client[-_]?secret|credentials)$/i;

/**
 * Recursively redacts sensitive values from an object or array.
 * @param {any} data - Input object, array, or primitive
 * @returns {any} - Deep copy with sensitive fields replaced with '[REDACTED]'
 */
function redactSecrets(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSecrets(item));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS_REGEX.test(key)) {
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
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSecrets(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

module.exports = {
  redactSecrets,
  redact: redactSecrets,
};

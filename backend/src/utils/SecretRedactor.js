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

/**
 * Redacts database URIs and webhook URLs that include sensitive tokens/passwords
 */
function redactUriString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(DB_URI_REGEX, '$1[REDACTED]$2')
    .replace(DISCORD_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_WEBHOOK_REGEX, '$1[REDACTED]')
    .replace(SLACK_TOKEN_REGEX, '[REDACTED]')
    .replace(AWS_ACCESS_KEY_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNATURE_REGEX, '$1[REDACTED]')
    .replace(AWS_SIGNED_URL_REGEX, '$1[REDACTED]');
}

/**
 * Recursively redacts sensitive values from an object or array.
 * @param {any} data - Input object, array, or primitive
 * @returns {any} - Deep copy with sensitive fields replaced with '[REDACTED]'
 */
function redactSecrets(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return redactUriString(data);
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
    } else if (typeof value === 'string') {
      redacted[key] = redactUriString(value);
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

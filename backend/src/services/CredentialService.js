const crypto = require('crypto');

// Encryption algorithm constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;    // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;   // 128-bit auth tag

/**
 * Derives a 32-byte key from the CREDENTIAL_ENCRYPTION_KEY env var.
 * In production mode, CREDENTIAL_ENCRYPTION_KEY is strictly mandatory and must
 * have sufficient entropy (>= 32 characters).
 * In development/test mode, falls back to a deterministic development key with a warning.
 */
function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw || !String(raw).trim()) {
    if (isProd) {
      throw new Error(
        'Configuration Error: CREDENTIAL_ENCRYPTION_KEY environment variable is required in production mode. Refusing startup to prevent insecure secret storage.'
      );
    }
    console.warn(
      '⚠  CREDENTIAL_ENCRYPTION_KEY is not set. Using insecure development key. ' +
      'Set this variable in production!'
    );
    // Stable 32-byte dev key for development/test backwards compatibility
    return crypto.createHash('sha256').update('logicbridge_dev_key').digest();
  }

  const cleanKey = String(raw).trim();
  if (isProd && cleanKey.length < 32) {
    throw new Error(
      'Configuration Error: CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters in length in production.'
    );
  }

  // Derive a stable 32-byte key from the user-supplied string
  return crypto.createHash('sha256').update(cleanKey).digest();
}

/**
 * Validates encryption configuration at startup.
 * Throws a fatal configuration error if key is missing or invalid in production.
 */
function validateConfiguration() {
  return getKey();
}

/**
 * CredentialService — symmetric AES-256-GCM encryption for stored credentials.
 *
 * Output format (base64-encoded):  iv(12) | authTag(16) | ciphertext
 */
const CredentialService = {
  /**
   * Encrypts a credentials object and returns a base64 ciphertext string.
   * @param {object|string} credentials
   * @returns {string} base64 encrypted blob
   */
  encrypt(credentials) {
    const plaintext =
      typeof credentials === 'object'
        ? JSON.stringify(credentials)
        : String(credentials);

    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Pack: iv | authTag | ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString('base64');
  },

  /**
   * Decrypts a base64 credential blob back to an object (or string).
   * @param {string} blob - base64 encrypted blob
   * @returns {object|string} decrypted credentials
   */
  decrypt(blob) {
    if (!blob) return null;

    const packed = Buffer.from(blob, 'base64');
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  },

  /**
   * Returns a sanitized representation of credentials safe for logging.
   * All values are masked; only keys are visible.
   * @param {object} credentials
   * @returns {object}
   */
  redact(credentials) {
    if (!credentials || typeof credentials !== 'object') return {};
    return Object.fromEntries(
      Object.keys(credentials).map((k) => [k, '***'])
    );
  },

  validateConfiguration,
  getKey,
};

module.exports = CredentialService;

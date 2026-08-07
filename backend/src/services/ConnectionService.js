const Connection = require('../models/Connection');
const CredentialService = require('./CredentialService');
const { connectionRegistry } = require('../providers/connections');
const OAuthService = require('./OAuthService');

/**
 * ConnectionService — user connection CRUD and verification.
 *
 * Credentials are always encrypted before storage and decrypted on retrieval.
 * The raw credentials object never leaves this service unencrypted.
 */
const ConnectionService = {
  /**
   * Get all connections for a user (no credentials returned).
   */
  async getConnectionsByOwner(ownerId) {
    return Connection.find({ owner: ownerId }).sort({ createdAt: -1 });
  },

  /**
   * Get a single connection by ID and owner (no credentials returned).
   */
  async getConnectionById(connectionId, ownerId) {
    const conn = await Connection.findOne({ _id: connectionId, owner: ownerId });
    if (!conn) {
      const err = new Error('Connection not found');
      err.statusCode = 404;
      throw err;
    }
    return conn;
  },

  /**
   * Create a new connection.
   * Validates provider, encrypts credentials, then runs connect() to verify.
   *
   * @param {object} params
   * @param {string} params.ownerId
   * @param {string} params.provider
   * @param {string} params.name
   * @param {object} params.credentials - plaintext credentials (never persisted raw)
   */
  async createConnection({ ownerId, provider, name, credentials = {} }) {
    // Ensure provider is registered
    const providerInstance = connectionRegistry.resolve(provider);

    // Validate required fields
    ConnectionService._validateRequiredFields(providerInstance, credentials);

    // Attempt connection verification before saving
    const connectResult = await providerInstance.connect(credentials);
    const encrypted = CredentialService.encrypt(credentials);

    const conn = await Connection.create({
      owner: ownerId,
      provider,
      name,
      email: connectResult.email || credentials.user || credentials.email || '',
      status: connectResult.success ? 'active' : 'disconnected',
      credentials: encrypted,
      metadata: connectResult.metadata || {},
      lastVerifiedAt: connectResult.success ? new Date() : null,
    });

    return conn;
  },

  /**
   * Update a connection's name, credentials, or metadata.
   */
  async updateConnection(connectionId, ownerId, updates) {
    const conn = await ConnectionService.getConnectionById(connectionId, ownerId);

    if (updates.name) conn.name = updates.name;

    if (updates.credentials && typeof updates.credentials === 'object') {
      const providerInstance = connectionRegistry.resolve(conn.provider);
      ConnectionService._validateRequiredFields(providerInstance, updates.credentials);
      conn.credentials = CredentialService.encrypt(updates.credentials);
      conn.status = 'pending';
    }

    await conn.save();
    return conn;
  },

  /**
   * Delete a connection and revoke credentials if provider supports it.
   */
  async deleteConnection(connectionId, ownerId) {
    const conn = await Connection.findOne({ _id: connectionId, owner: ownerId }).select('+credentials');
    if (!conn) {
      const err = new Error('Connection not found');
      err.statusCode = 404;
      throw err;
    }

    // Best-effort disconnect
    try {
      const provider = connectionRegistry.resolve(conn.provider);
      const creds = CredentialService.decrypt(conn.credentials);
      await provider.disconnect(creds);
    } catch {
      // Non-fatal — proceed with deletion regardless
    }

    await Connection.deleteOne({ _id: connectionId });
    return { deleted: true };
  },

  /**
   * Verify that a stored connection is still valid and update status.
   */
  async verifyConnection(connectionId, ownerId) {
    const conn = await Connection.findOne({ _id: connectionId, owner: ownerId }).select('+credentials');
    if (!conn) {
      const err = new Error('Connection not found');
      err.statusCode = 404;
      throw err;
    }

    const provider = connectionRegistry.resolve(conn.provider);
    const creds = CredentialService.decrypt(conn.credentials);
    const result = await provider.verify(creds);

    conn.status = result.ok ? 'active' : 'disconnected';
    if (result.ok) conn.lastVerifiedAt = new Date();
    await conn.save();

    return { ...result, status: conn.status };
  },

  /**
   * Retrieve decrypted credentials for a connection.
   * For Gmail connections, automatically refreshes an expired access token
   * and persists the new token before returning.
   * Only used internally by node executors — never exposed via API response.
   */
  async getDecryptedCredentials(connectionId, ownerId) {
    const conn = await Connection.findOne({ _id: connectionId, owner: ownerId }).select('+credentials');
    if (!conn) {
      const err = new Error('Connection not found');
      err.statusCode = 404;
      throw err;
    }

    let credentials = CredentialService.decrypt(conn.credentials);

    // Auto-refresh expired Gmail OAuth tokens
    if (conn.provider === 'gmail' && credentials.refreshToken && OAuthService.isConfigured()) {
      const isExpired = credentials.expiryDate && (credentials.expiryDate - Date.now()) < 60_000;
      if (isExpired) {
        try {
          credentials = await OAuthService.refreshAccessToken(credentials);
          conn.credentials = CredentialService.encrypt(credentials);
          await conn.save();
        } catch (refreshErr) {
          // Surface a clear error rather than a cryptic Gmail API error later
          const err = new Error(`Gmail token refresh failed: ${refreshErr.message}. Please reconnect your Gmail account.`);
          err.statusCode = 401;
          throw err;
        }
      }
    }

    return credentials;
  },

  /**
   * Internal — validates that all requiredFields for a provider are present.
   * @private
   */
  _validateRequiredFields(providerInstance, credentials) {
    const missing = providerInstance.requiredFields
      .filter((f) => f.required && !credentials[f.key])
      .map((f) => f.label || f.key);

    if (missing.length > 0) {
      const err = new Error(`Missing required fields: ${missing.join(', ')}`);
      err.statusCode = 422;
      throw err;
    }
  },
};

module.exports = ConnectionService;

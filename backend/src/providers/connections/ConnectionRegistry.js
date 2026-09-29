const SMTPConnectionProvider = require('./SMTPConnectionProvider');
const GmailConnectionProvider = require('./GmailConnectionProvider');
const HttpConnectionProvider = require('./HttpConnectionProvider');
const PostgreSQLConnectionProvider = require('./PostgreSQLConnectionProvider');
const MongoDBConnectionProvider = require('./MongoDBConnectionProvider');

/**
 * ConnectionRegistry — central registry for all connection providers.
 *
 * Mirrors the Node Registry pattern:
 *   - providers are registered once at startup
 *   - resolved by ID on demand
 *   - metadata enumerated for the UI
 */
class ConnectionRegistry {
  constructor() {
    this._providers = new Map();
  }

  /**
   * Register a ConnectionProvider instance.
   * @param {ConnectionProvider} provider
   */
  register(provider) {
    this._providers.set(provider.id, provider);
    return this;
  }

  /**
   * Resolve a provider by its string ID.
   * @param {string} id
   * @returns {ConnectionProvider}
   */
  resolve(id) {
    const provider = this._providers.get(id);
    if (!provider) {
      const err = new Error(`Unknown connection provider: "${id}"`);
      err.statusCode = 400;
      throw err;
    }
    return provider;
  }

  /**
   * Returns metadata for all registered providers — used to drive the UI.
   * @returns {object[]}
   */
  listMetadata() {
    return Array.from(this._providers.values()).map((p) => p.metadata());
  }

  /**
   * Returns true if a provider with the given ID is registered.
   */
  has(id) {
    return this._providers.has(id);
  }
}

// ── Singleton registry initialized at module load ─────────────────────────────
const connectionRegistry = new ConnectionRegistry();
connectionRegistry
  .register(new SMTPConnectionProvider())
  .register(new GmailConnectionProvider())
  .register(new HttpConnectionProvider())
  .register(new PostgreSQLConnectionProvider())
  .register(new MongoDBConnectionProvider());

module.exports = {
  ConnectionRegistry,
  connectionRegistry,
};

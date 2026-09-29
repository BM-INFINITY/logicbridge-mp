const ConnectionProvider = require('./ConnectionProvider');
const { MongoClient } = require('mongodb');

/**
 * MongoDBConnectionProvider — manages MongoDB database credentials and verification.
 * Credentials remain encrypted and are never exposed in logs or API responses.
 */
class MongoDBConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'mongodb',
      name: 'MongoDB',
      icon: '🍃',
      category: 'database',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        { key: 'connectionString', label: 'Connection URI', type: 'password', required: false, placeholder: 'mongodb://localhost:27017 or mongodb+srv://...' },
        { key: 'host', label: 'Host', type: 'text', required: false, placeholder: 'localhost' },
        { key: 'port', label: 'Port', type: 'number', required: false, placeholder: '27017' },
        { key: 'database', label: 'Database Name', type: 'text', required: true, placeholder: 'my_database' },
        { key: 'user', label: 'Username', type: 'text', required: false, placeholder: 'admin' },
        { key: 'password', label: 'Password', type: 'password', required: false, placeholder: '••••••••' },
      ],
    });
  }

  /**
   * Constructs MongoDB connection URI from credentials
   * @param {object} credentials
   * @returns {string}
   */
  getUri(credentials = {}) {
    if (credentials.connectionString && String(credentials.connectionString).trim()) {
      return String(credentials.connectionString).trim();
    }

    const host = credentials.host || 'localhost';
    const port = credentials.port ? Number(credentials.port) : 27017;
    const database = credentials.database || '';
    const user = credentials.user ? encodeURIComponent(credentials.user) : '';
    const pass = credentials.password ? encodeURIComponent(credentials.password) : '';

    if (user && pass) {
      return `mongodb://${user}:${pass}@${host}:${port}/${database}`;
    }
    return `mongodb://${host}:${port}/${database}`;
  }

  /**
   * Connect to MongoDB to verify credentials and accessibility
   * @param {object} credentials
   * @returns {Promise<{ success: boolean, email?: string, metadata?: object, error?: string }>}
   */
  async connect(credentials = {}) {
    const uri = this.getUri(credentials);
    const dbName = credentials.database || 'admin';
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    try {
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
      await client.close();

      const displayDb = credentials.database || 'MongoDB';
      const displayHost = credentials.host || (credentials.connectionString ? 'Cluster' : 'localhost');

      return {
        success: true,
        email: `${displayDb} @ ${displayHost}`,
        metadata: {
          database: credentials.database,
          host: credentials.host,
        },
      };
    } catch (err) {
      try {
        await client.close().catch(() => {});
      } catch {
        // ignore
      }
      const rawMessage = err.message || 'Connection failed';
      // Sanitize any passwords or credentials embedded in the error message
      const safeMessage = rawMessage.replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@');
      return {
        success: false,
        error: safeMessage,
      };
    }
  }

  /**
   * Verify that stored credentials are still valid
   * @param {object} credentials
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async verify(credentials) {
    const result = await this.connect(credentials);
    if (result.success) {
      return { ok: true, message: 'MongoDB connection verified successfully' };
    }
    return { ok: false, message: `MongoDB connection verification failed: ${result.error}` };
  }

  async disconnect(_credentials) {
    return { success: true };
  }

  async refresh(credentials) {
    return credentials;
  }
}

module.exports = MongoDBConnectionProvider;

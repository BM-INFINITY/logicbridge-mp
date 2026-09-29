const ConnectionProvider = require('./ConnectionProvider');
const { Client } = require('pg');

/**
 * PostgreSQLConnectionProvider — manages PostgreSQL database credentials and verification.
 * Credentials remain encrypted and are never exposed in logs or API responses.
 */
class PostgreSQLConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'postgres',
      name: 'PostgreSQL',
      icon: '🐘',
      category: 'database',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost or postgres.example.com' },
        { key: 'port', label: 'Port', type: 'number', required: false, placeholder: '5432' },
        { key: 'database', label: 'Database Name', type: 'text', required: true, placeholder: 'postgres' },
        { key: 'user', label: 'Username', type: 'text', required: true, placeholder: 'postgres' },
        { key: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' },
        { key: 'ssl', label: 'Enable SSL', type: 'checkbox', required: false },
        { key: 'connectionString', label: 'Connection String (Override)', type: 'password', required: false, placeholder: 'postgresql://user:pass@host:5432/dbname' },
      ],
    });
  }

  /**
   * Builds pg client configuration from stored credentials
   * @param {object} credentials
   * @returns {object}
   */
  getClientConfig(credentials = {}) {
    if (credentials.connectionString && String(credentials.connectionString).trim()) {
      return {
        connectionString: String(credentials.connectionString).trim(),
        connectionTimeoutMillis: 5000,
        ssl: credentials.ssl ? { rejectUnauthorized: false } : false,
      };
    }

    const host = credentials.host || 'localhost';
    const port = Number(credentials.port) || 5432;
    const database = credentials.database || '';
    const user = credentials.user || '';
    const password = credentials.password || '';
    const ssl = credentials.ssl ? { rejectUnauthorized: false } : false;

    return {
      host,
      port,
      database,
      user,
      password,
      ssl,
      connectionTimeoutMillis: 5000,
    };
  }

  /**
   * Connect to PostgreSQL to verify credentials and accessibility
   * @param {object} credentials
   * @returns {Promise<{ success: boolean, email?: string, metadata?: object, error?: string }>}
   */
  async connect(credentials = {}) {
    const config = this.getClientConfig(credentials);
    const client = new Client(config);

    try {
      await client.connect();
      await client.query('SELECT 1 AS ok');
      await client.end();

      const displayDb = credentials.database || 'postgres';
      const displayHost = credentials.host || 'localhost';
      const displayUser = credentials.user || 'postgres';

      return {
        success: true,
        email: `${displayUser}@${displayHost}/${displayDb}`,
        metadata: {
          host: credentials.host,
          port: credentials.port || 5432,
          database: credentials.database,
          user: credentials.user,
          ssl: !!credentials.ssl,
        },
      };
    } catch (err) {
      try {
        await client.end().catch(() => {});
      } catch {
        // ignore
      }
      const safeMessage = (err.message || 'Connection failed').replace(/password=([^\s]+)/gi, 'password=[REDACTED]');
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
      return { ok: true, message: 'PostgreSQL connection verified successfully' };
    }
    return { ok: false, message: `PostgreSQL connection verification failed: ${result.error}` };
  }

  async disconnect(_credentials) {
    return { success: true };
  }

  async refresh(credentials) {
    return credentials;
  }
}

module.exports = PostgreSQLConnectionProvider;

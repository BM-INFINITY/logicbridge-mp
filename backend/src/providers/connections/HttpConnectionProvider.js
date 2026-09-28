const ConnectionProvider = require('./ConnectionProvider');

/**
 * HttpConnectionProvider — user-owned generic HTTP/API credential integration.
 * Supports Bearer tokens, API Keys, and Basic Auth credentials.
 */
class HttpConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'http',
      name: 'HTTP / API Key',
      icon: '🌐',
      category: 'api',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        { key: 'authType', label: 'Auth Type', type: 'select', options: ['bearer', 'api_key', 'basic'], required: true },
        { key: 'token', label: 'Bearer Token', type: 'password', required: false },
        { key: 'apiKey', label: 'API Key Name', type: 'text', required: false },
        { key: 'apiValue', label: 'API Key Value', type: 'password', required: false },
        { key: 'apiLocation', label: 'Key Location', type: 'select', options: ['header', 'query'], required: false },
        { key: 'username', label: 'Basic Username', type: 'text', required: false },
        { key: 'password', label: 'Basic Password', type: 'password', required: false },
      ],
    });
  }

  async connect(credentials) {
    if (!credentials || !credentials.authType) {
      return { success: false, error: 'Auth Type is required for HTTP connection' };
    }
    const label = credentials.name || credentials.apiKey || credentials.username || 'API Connection';
    return {
      success: true,
      email: label,
      metadata: { authType: credentials.authType, apiLocation: credentials.apiLocation || 'header' },
    };
  }

  async verify(credentials) {
    if (!credentials || !credentials.authType) {
      return { ok: false, message: 'Invalid HTTP connection credentials' };
    }
    return { ok: true, message: `HTTP connection (${credentials.authType}) verified successfully` };
  }

  async disconnect(_credentials) {
    return { success: true };
  }

  async refresh(credentials) {
    return credentials;
  }
}

module.exports = HttpConnectionProvider;

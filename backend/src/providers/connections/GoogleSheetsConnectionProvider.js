const ConnectionProvider = require('./ConnectionProvider');
const OAuthService = require('../../services/OAuthService');

/**
 * GoogleSheetsConnectionProvider — Google Sheets OAuth 2.0 provider.
 *
 * Uses Google OAuth 2.0 tokens to read, append, update, and manage spreadsheets via the Google Sheets API.
 * Token refresh is automatic using the stored refresh token.
 */
class GoogleSheetsConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'google_sheets',
      name: 'Google Sheets',
      icon: '📊',
      category: 'spreadsheet',
      supportsVerification: true,
      supportsOAuth: true,
      supportsRefresh: true,
      requiredFields: [], // OAuth 2.0 — credentials come from Google consent screen
    });
  }

  /**
   * Called after OAuth token exchange completes.
   * Credentials are encrypted and stored securely.
   * @param {object} credentials - { accessToken, refreshToken, expiryDate, email, name, picture }
   */
  async connect(credentials) {
    return {
      success: true,
      email: credentials.email,
      metadata: { name: credentials.name, picture: credentials.picture },
    };
  }

  /**
   * Verify Google Sheets credentials by querying user info with the authenticated client.
   */
  async verify(credentials) {
    const res = await OAuthService.verifyCredentials(credentials, 'google_sheets');
    return {
      valid: res.ok ?? res.valid ?? false,
      message: res.message,
      email: res.email,
    };
  }

  /**
   * Disconnect: revoke access token and clean up.
   */
  async disconnect(credentials) {
    if (credentials?.accessToken) {
      await OAuthService.revokeToken(credentials.accessToken);
    }
    return { success: true };
  }

  /**
   * Refresh access token using stored refresh token.
   */
  async refresh(credentials) {
    return OAuthService.refreshAccessToken(credentials);
  }

  async verifyCredentials(credentials) {
    return this.verify(credentials);
  }

  async refreshToken(credentials) {
    return this.refresh(credentials);
  }
}

module.exports = GoogleSheetsConnectionProvider;

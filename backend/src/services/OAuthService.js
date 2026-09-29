const { google } = require('googleapis');
const CredentialService = require('./CredentialService');

/**
 * OAuthService — Google OAuth 2.0 Authorization Code Flow.
 *
 * All sensitive logic (URL generation, token exchange, refresh, revoke)
 * lives here — controllers remain thin.
 */

function buildClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const PROVIDER_SCOPES = {
  gmail: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  google_sheets: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ],
};

const SCOPES = PROVIDER_SCOPES.gmail;

const OAuthService = {
  PROVIDER_SCOPES,

  /**
   * Check that required env vars are set.
   */
  isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
    );
  },

  /**
   * Generate a Google OAuth consent URL.
   * The state param encodes the authenticated userId and provider so the callback can
   * associate the token with the correct user and provider.
   *
   * @param {string} userId - MongoDB user _id
   * @param {string} connectionName - User-provided display name
   * @param {string} provider - Provider id ('gmail' or 'google_sheets')
   * @returns {string} redirect URL
   */
  generateAuthUrl(userId, connectionName = 'My Google Account', provider = 'gmail') {
    if (!OAuthService.isConfigured()) {
      throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.');
    }
    const client = buildClient();
    const scopes = PROVIDER_SCOPES[provider] || PROVIDER_SCOPES.gmail;
    // Encode userId + connectionName + provider in state so callback can retrieve them
    const state = Buffer.from(JSON.stringify({ userId, connectionName, provider })).toString('base64url');
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',         // force consent so we always get refresh_token
      scope: scopes,
      state,
    });
  },

  /**
   * Decode the state param from the OAuth callback.
   * @param {string} state - base64url encoded state
   * @returns {{ userId: string, connectionName: string, provider: string }}
   */
  decodeState(state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      return {
        userId: decoded.userId,
        connectionName: decoded.connectionName,
        provider: decoded.provider || 'gmail',
      };
    } catch {
      throw new Error('Invalid OAuth state parameter');
    }
  },

  /**
   * Exchange an authorization code for access + refresh tokens.
   * @param {string} code - OAuth authorization code from callback
   * @returns {object} tokens payload { accessToken, refreshToken, expiryDate, email, name }
   */
  async exchangeCode(code) {
    const client = buildClient();
    let tokenResponse;
    try {
      tokenResponse = await client.getToken(code);
    } catch (err) {
      const msg = err.response?.data?.error_description || err.message || 'Token exchange failed';
      const error = new Error(`Google OAuth authorization failed: ${msg}`);
      error.statusCode = 400;
      throw error;
    }

    const tokens = tokenResponse.tokens;
    if (!tokens.refresh_token) {
      // This can happen if user already authorized once without revoke+reconnect
      const error = new Error(
        'Google did not return a refresh token. Revoke access at myaccount.google.com/permissions and reconnect.'
      );
      error.statusCode = 400;
      throw error;
    }

    // Fetch user profile using the tokens
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
  },

  /**
   * Refresh an expired access token using the stored refresh token.
   * @param {object} credentials - decrypted credentials with refreshToken
   * @returns {object} updated credentials payload
   */
  async refreshAccessToken(credentials) {
    const client = buildClient();
    const refreshToken = credentials.refreshToken || credentials.refresh_token;
    client.setCredentials({ refresh_token: refreshToken });

    let newTokens;
    try {
      const { credentials: refreshed } = await client.refreshAccessToken();
      newTokens = refreshed;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Token refresh failed';
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
        const error = new Error('Google refresh token is invalid or has been revoked. Please reconnect your account.');
        error.statusCode = 401;
        throw error;
      }
      throw new Error(`Google token refresh failed: ${msg}`);
    }

    return {
      ...credentials,
      accessToken: newTokens.access_token,
      access_token: newTokens.access_token,
      expiryDate: newTokens.expiry_date,
      expiry_date: newTokens.expiry_date,
    };
  },

  /**
   * Revoke tokens on disconnect.
   * @param {string} accessToken
   */
  async revokeToken(accessToken) {
    if (!accessToken) return;
    try {
      const client = buildClient();
      await client.revokeToken(accessToken);
    } catch {
      // Best-effort — non-fatal
    }
  },

  /**
   * Build an authenticated Google OAuth2 client from stored credentials.
   * Automatically refreshes if access token is expired.
   *
   * @param {object} credentials - decrypted credentials
   * @returns {{ client: OAuth2Client, credentials: object }} updated credentials if refreshed
   */
  async buildAuthenticatedClient(credentials) {
    const client = buildClient();
    client.setCredentials({
      access_token: credentials.accessToken || credentials.access_token,
      refresh_token: credentials.refreshToken || credentials.refresh_token,
      expiry_date: credentials.expiryDate || credentials.expiry_date,
    });

    // Check if token is expired (with 60-second buffer)
    const expiryDate = credentials.expiryDate || credentials.expiry_date;
    const isExpired = expiryDate && (expiryDate - Date.now()) < 60_000;
    let updatedCredentials = credentials;

    if (isExpired) {
      updatedCredentials = await OAuthService.refreshAccessToken(credentials);
      client.setCredentials({
        access_token: updatedCredentials.accessToken || updatedCredentials.access_token,
        refresh_token: updatedCredentials.refreshToken || updatedCredentials.refresh_token,
        expiry_date: updatedCredentials.expiryDate || updatedCredentials.expiry_date,
      });
    }

    return { client, credentials: updatedCredentials, wasRefreshed: isExpired };
  },

  /**
   * Verify that a stored credential can still reach Google APIs.
   * @param {object} credentials - decrypted credentials
   * @returns {{ ok: boolean, valid: boolean, email: string, message: string }}
   */
  async verifyCredentials(credentials, provider = 'gmail') {
    const label = provider === 'google_sheets' ? 'Google Sheets' : 'Gmail';
    if (!credentials || (!credentials.accessToken && !credentials.access_token)) {
      return { ok: false, valid: false, message: `${label} credentials missing access token` };
    }
    try {
      const { client } = await OAuthService.buildAuthenticatedClient(credentials);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const { data: profile } = await oauth2.userinfo.get();
      return { ok: true, valid: true, email: profile?.email || 'verified', message: `${label} verified for ${profile?.email}` };
    } catch (err) {
      const msg = err.message || `${label} verification failed`;
      return { ok: false, valid: false, message: msg };
    }
  },
};

module.exports = OAuthService;

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

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
];

const OAuthService = {
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
   * The state param encodes the authenticated userId so the callback can
   * associate the token with the correct user.
   *
   * @param {string} userId - MongoDB user _id
   * @param {string} connectionName - User-provided display name
   * @returns {string} redirect URL
   */
  generateAuthUrl(userId, connectionName = 'My Gmail') {
    if (!OAuthService.isConfigured()) {
      throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.');
    }
    const client = buildClient();
    // Encode userId + connectionName in state so callback can retrieve them
    const state = Buffer.from(JSON.stringify({ userId, connectionName })).toString('base64url');
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',         // force consent so we always get refresh_token
      scope: SCOPES,
      state,
    });
  },

  /**
   * Decode the state param from the OAuth callback.
   * @param {string} state - base64url encoded state
   * @returns {{ userId: string, connectionName: string }}
   */
  decodeState(state) {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
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
    client.setCredentials({ refresh_token: credentials.refreshToken });

    let newTokens;
    try {
      const { credentials: refreshed } = await client.refreshAccessToken();
      newTokens = refreshed;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Token refresh failed';
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
        const error = new Error('Gmail refresh token is invalid or has been revoked. Please reconnect your Gmail account.');
        error.statusCode = 401;
        throw error;
      }
      throw new Error(`Google token refresh failed: ${msg}`);
    }

    return {
      ...credentials,
      accessToken: newTokens.access_token,
      expiryDate: newTokens.expiry_date,
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
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });

    // Check if token is expired (with 60-second buffer)
    const isExpired = credentials.expiryDate && (credentials.expiryDate - Date.now()) < 60_000;
    let updatedCredentials = credentials;

    if (isExpired) {
      updatedCredentials = await OAuthService.refreshAccessToken(credentials);
      client.setCredentials({
        access_token: updatedCredentials.accessToken,
        refresh_token: updatedCredentials.refreshToken,
        expiry_date: updatedCredentials.expiryDate,
      });
    }

    return { client, credentials: updatedCredentials, wasRefreshed: isExpired };
  },

  /**
   * Verify that a stored credential can still reach Google APIs.
   * @param {object} credentials - decrypted credentials
   * @returns {{ ok: boolean, email: string, message: string }}
   */
  async verifyCredentials(credentials) {
    try {
      const { client } = await OAuthService.buildAuthenticatedClient(credentials);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const { data: profile } = await oauth2.userinfo.get();
      return { ok: true, email: profile.email, message: `Gmail verified for ${profile.email}` };
    } catch (err) {
      const msg = err.message || 'Gmail verification failed';
      return { ok: false, message: msg };
    }
  },
};

module.exports = OAuthService;

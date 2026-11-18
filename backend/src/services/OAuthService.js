const crypto = require('crypto');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const CredentialService = require('./CredentialService');
const OAuthNonce = require('../models/OAuthNonce');

/**
 * In-memory active nonce registry for single-use OAuth state protection.
 * Pruned periodically based on expiration time.
 */
const activeNonces = new Map(); // nonce -> { userId, expiresAt }
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getStateSigningSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'logicbridge_secure_oauth_signing_secret';
}

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
   * Cryptographically generates a random nonce, sets a 10-minute expiration window,
   * binds the state to the initiating userId and browser session, and signs it with HMAC-SHA256.
   *
   * @param {string} userId - MongoDB user _id
   * @param {string} connectionName - User-provided display name
   * @param {string} provider - Provider id ('gmail' or 'google_sheets')
   * @param {object} [options]
   * @param {string} [options.sessionId] - Session ID / browser session fingerprint
   * @returns {string} redirect URL
   */
  generateAuthUrl(userId, connectionName = 'My Google Account', provider = 'gmail', options = {}) {
    if (!OAuthService.isConfigured()) {
      throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.');
    }
    const client = buildClient();
    const scopes = PROVIDER_SCOPES[provider] || PROVIDER_SCOPES.gmail;

    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + STATE_TTL_MS;
    const sessionId = options.sessionId || options.sessionToken || null;

    // Prune expired nonces
    for (const [n, meta] of activeNonces.entries()) {
      if (meta.expiresAt < now) {
        activeNonces.delete(n);
      }
    }

    // Register active nonce for single-use consumption in memory (non-production only)
    const isProd = process.env.NODE_ENV === 'production';
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

    if (isProd && !isDbConnected) {
      const error = new Error('Database service unavailable for durable OAuth state persistence');
      error.statusCode = 503;
      throw error;
    }

    if (isDbConnected) {
      try {
        OAuthNonce.create({
          nonce,
          userId: String(userId),
          sessionId,
          connectionName,
          provider,
          expiresAt: new Date(expiresAt),
        }).catch((err) => {
          if (isProd) {
            console.error('Failed to persist OAuthNonce in production:', err.message);
          }
        });
      } catch (err) {
        if (isProd) {
          const error = new Error(`Database error saving OAuth nonce: ${err.message}`);
          error.statusCode = 503;
          throw error;
        }
      }
    }

    if (!isProd) {
      activeNonces.set(nonce, { userId: String(userId), sessionId, expiresAt });
    }

    const payload = {
      userId: String(userId),
      connectionName,
      provider,
      nonce,
      sessionId,
      issuedAt: now,
      expiresAt,
    };

    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', getStateSigningSecret())
      .update(serializedPayload)
      .digest('base64url');

    const state = `${serializedPayload}.${signature}`;

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',         // force consent so we always get refresh_token
      scope: scopes,
      state,
    });
  },

  /**
   * Decode, verify integrity, check expiration, and single-use consume the OAuth state param.
   * Protects against OAuth CSRF, token replay, and cross-user account injection.
   *
   * @param {string} state - base64url encoded and signed state (payload.signature)
   * @param {object} [options]
   * @param {string} [options.sessionId] - Session identifier to enforce session binding
   * @returns {{ userId: string, connectionName: string, provider: string, sessionId?: string, nonce: string }}
   */
  decodeState(state, options = {}) {
    if (!state || typeof state !== 'string') {
      throw new Error('Invalid OAuth state parameter: missing state');
    }

    const parts = state.trim().split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid OAuth state parameter: malformed signature format');
    }

    const [serializedPayload, providedSignature] = parts;

    // 1. Verify HMAC signature in constant time
    const expectedSignature = crypto
      .createHmac('sha256', getStateSigningSecret())
      .update(serializedPayload)
      .digest('base64url');

    const bufExpected = Buffer.from(expectedSignature);
    const bufProvided = Buffer.from(providedSignature);

    if (bufExpected.length !== bufProvided.length || !crypto.timingSafeEqual(bufExpected, bufProvided)) {
      throw new Error('Invalid OAuth state parameter: signature mismatch / tampered state');
    }

    // 2. Deserialize payload
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(serializedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Invalid OAuth state parameter: malformed payload');
    }

    const { userId, connectionName, provider = 'gmail', nonce, sessionId, expiresAt } = decoded;

    if (!userId || !nonce) {
      throw new Error('Invalid OAuth state parameter: missing required claims');
    }

    // 3. Expiration check
    if (!expiresAt || Date.now() > Number(expiresAt)) {
      throw new Error('Invalid OAuth state parameter: state token has expired');
    }

    // 4. Session binding verification: cannot be bypassed by omitting options.sessionId
    if (sessionId) {
      if (!options.sessionId || options.sessionId !== sessionId) {
        throw new Error('Invalid OAuth state parameter: session mismatch / cross-session injection detected');
      }
    }

    const isProd = process.env.NODE_ENV === 'production';
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

    if (isProd && !isDbConnected) {
      const error = new Error('Database service unavailable for OAuth state verification');
      error.statusCode = 503;
      throw error;
    }

    // 5. One-time nonce consumption (replay protection)
    if (!activeNonces.has(nonce)) {
      throw new Error('Invalid OAuth state parameter: state has already been consumed (replay detected)');
    }

    const nonceMeta = activeNonces.get(nonce);
    activeNonces.delete(nonce); // Single-use consumption

    // 6. Cross-user verification
    if (nonceMeta.userId !== String(userId)) {
      throw new Error('Invalid OAuth state parameter: user mismatch detected');
    }

    if (nonceMeta.sessionId && (!options.sessionId || nonceMeta.sessionId !== options.sessionId)) {
      throw new Error('Invalid OAuth state parameter: session mismatch / cross-session injection detected');
    }

    if (isDbConnected) {
      OAuthNonce.findOneAndDelete({ nonce }).catch(() => {});
    }

    return {
      userId,
      connectionName: connectionName || 'My Google Account',
      provider,
      sessionId: sessionId || null,
      nonce,
    };
  },

  /**
   * Distributed atomic state verification and consumption across backend instances
   */
  async verifyAndConsumeState(state, options = {}) {
    const isProd = process.env.NODE_ENV === 'production';
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

    if (isProd && !isDbConnected) {
      const error = new Error('Database service unavailable for OAuth state verification');
      error.statusCode = 503;
      throw error;
    }

    if (isDbConnected) {
      // 1. Basic decode without popping in-memory activeNonces first
      const parts = String(state || '').trim().split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid OAuth state parameter: malformed signature format');
      }
      const [serializedPayload, providedSignature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', getStateSigningSecret())
        .update(serializedPayload)
        .digest('base64url');

      const bufExpected = Buffer.from(expectedSignature);
      const bufProvided = Buffer.from(providedSignature);

      if (bufExpected.length !== bufProvided.length || !crypto.timingSafeEqual(bufExpected, bufProvided)) {
        throw new Error('Invalid OAuth state parameter: signature mismatch / tampered state');
      }

      let decoded;
      try {
        decoded = JSON.parse(Buffer.from(serializedPayload, 'base64url').toString('utf8'));
      } catch {
        throw new Error('Invalid OAuth state parameter: malformed payload');
      }

      const { userId, connectionName, provider = 'gmail', nonce, sessionId, expiresAt } = decoded;

      if (!userId || !nonce) {
        throw new Error('Invalid OAuth state parameter: missing required claims');
      }

      if (!expiresAt || Date.now() > Number(expiresAt)) {
        throw new Error('Invalid OAuth state parameter: state token has expired');
      }

      if (sessionId && (!options.sessionId || options.sessionId !== sessionId)) {
        throw new Error('Invalid OAuth state parameter: session mismatch / cross-session injection detected');
      }

      // Atomic single-use deletion from MongoDB across instances
      const dbNonce = await OAuthNonce.findOneAndDelete({ nonce, expiresAt: { $gt: new Date() } });
      if (!dbNonce) {
        // Check activeNonces as fallback in non-production
        if (!isProd && activeNonces.has(nonce)) {
          activeNonces.delete(nonce);
        } else {
          throw new Error('Invalid OAuth state parameter: state has already been consumed (replay detected)');
        }
      } else {
        if (String(dbNonce.userId) !== String(userId)) {
          throw new Error('Invalid OAuth state parameter: user mismatch detected');
        }
        if (dbNonce.provider && provider && dbNonce.provider !== provider) {
          throw new Error(`Invalid OAuth state parameter: provider mismatch ("${dbNonce.provider}" !== "${provider}")`);
        }
        if (dbNonce.sessionId && (!options.sessionId || dbNonce.sessionId !== options.sessionId)) {
          throw new Error('Invalid OAuth state parameter: session mismatch / cross-session injection detected');
        }
        activeNonces.delete(nonce);
      }

      return {
        userId,
        connectionName: connectionName || 'My Google Account',
        provider,
        sessionId: sessionId || null,
        nonce,
      };
    }

    // Offline / non-production fallback
    return this.decodeState(state, options);
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

  _activeNonces: activeNonces,
  _clearActiveNonces: () => activeNonces.clear(),
};

module.exports = OAuthService;

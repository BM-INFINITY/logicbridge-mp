const OAuthService = require('../services/OAuthService');
const ConnectionService = require('../services/ConnectionService');
const CredentialService = require('../services/CredentialService');
const Connection = require('../models/Connection');
const { success, error } = require('../utils/ResponseHelper');
const AuditLogger = require('../services/AuditLogger');

/**
 * GET /api/oauth/google?name=My+Gmail
 * Redirects the user to Google's consent screen.
 * Requires the user to be authenticated — userId is encoded in state param.
 */
const initiateGoogleAuth = (req, res, next) => {
  try {
    if (!OAuthService.isConfigured()) {
      return error(res, 'Google OAuth is not configured on this server.', 503);
    }
    const userId = String(req.user._id);
    const provider = req.query.provider || 'gmail';
    const connectionName = req.query.name || (provider === 'google_sheets' ? 'My Google Sheets' : 'My Gmail');
    const url = OAuthService.generateAuthUrl(userId, connectionName, provider);
    return res.redirect(url);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/oauth/google/callback?code=...&state=...
 * Google redirects here after the user authorizes.
 * Exchanges the code for tokens, creates/updates a Connection record.
 *
 * On success:  redirect to /connections?oauth=success
 * On failure:  redirect to /connections?oauth=error&msg=...
 */
const googleCallback = async (req, res, next) => {
  const { code, state, error: oauthError } = req.query;

  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

  // User cancelled or Google returned an error
  if (oauthError) {
    return res.redirect(`${FRONTEND}/connections?oauth=cancelled`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND}/connections?oauth=error&msg=Missing+code+or+state`);
  }

  const sessionId = req.cookies?.sessionId || req.headers?.['x-session-id'] || req.query.sessionId || null;

  let userId, connectionName, provider;
  try {
    ({ userId, connectionName, provider = 'gmail' } = await OAuthService.decodeState(state, { sessionId }));
  } catch (stateErr) {
    const errorMsg = encodeURIComponent(stateErr.message || 'Invalid state');
    return res.redirect(`${FRONTEND}/connections?oauth=error&msg=${errorMsg}`);
  }

  try {
    // Exchange code for tokens + profile
    const tokenPayload = await OAuthService.exchangeCode(code);

    // Check if this account is already connected for this user
    const existing = await Connection.findOne({
      owner: userId,
      provider,
      email: tokenPayload.email,
    }).select('+credentials');

    if (existing) {
      // Update existing connection with fresh tokens
      existing.credentials = CredentialService.encrypt(tokenPayload);
      existing.status = 'active';
      existing.lastVerifiedAt = new Date();
      existing.metadata = { name: tokenPayload.name, picture: tokenPayload.picture };
      await existing.save();
    } else {
      // Create brand new connection
      await Connection.create({
        owner: userId,
        provider,
        name: connectionName,
        email: tokenPayload.email,
        status: 'active',
        credentials: CredentialService.encrypt(tokenPayload),
        metadata: { name: tokenPayload.name, picture: tokenPayload.picture },
        lastVerifiedAt: new Date(),
      });
    }

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.OAUTH_CONNECTED,
      severity: 'info',
      actorId: userId,
      targetResource: `oauth:${provider}`,
      outcome: 'success',
      details: { provider, connectionName, email: tokenPayload.email },
    });

    return res.redirect(`${FRONTEND}/connections?oauth=success&provider=${provider}`);
  } catch (err) {
    const msg = encodeURIComponent(err.message || 'OAuth failed');
    return res.redirect(`${FRONTEND}/connections?oauth=error&msg=${msg}`);
  }
};

/**
 * POST /api/oauth/google/disconnect
 * Body: { connectionId }
 * Revokes Google token and removes the Connection record.
 */
const disconnectGoogle = async (req, res, next) => {
  try {
    const { connectionId } = req.body;
    if (!connectionId) return error(res, 'connectionId is required', 422);
    const result = await ConnectionService.deleteConnection(connectionId, req.user._id);

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.OAUTH_DISCONNECTED,
      severity: 'warn',
      actorId: req.user._id,
      targetResource: `connection:${connectionId}`,
      outcome: 'success',
      details: { connectionId },
    });

    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * GET /api/oauth/google/url
 * Returns the OAuth URL as JSON (for SPA navigation).
 * Query params: { name?, provider? }
 */
const getGoogleAuthUrl = (req, res, next) => {
  try {
    if (!OAuthService.isConfigured()) {
      return error(res, 'Google OAuth is not configured on this server.', 503);
    }
    const userId = String(req.user._id);
    const provider = req.query.provider || 'gmail';
    const connectionName = req.query.name || (provider === 'google_sheets' ? 'My Google Sheets' : 'My Gmail');
    const url = OAuthService.generateAuthUrl(userId, connectionName, provider);
    return success(res, { url });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  initiateGoogleAuth,
  googleCallback,
  disconnectGoogle,
  getGoogleAuthUrl,
};

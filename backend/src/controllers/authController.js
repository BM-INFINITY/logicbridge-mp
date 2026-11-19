const { userService } = require('../services');
const { authValidator } = require('../validators');
const { success, error } = require('../utils/ResponseHelper');
const { recordFailure, recordLoginSuccess, getClientIp } = require('../middleware/rateLimiter');
const AuditLogger = require('../services/AuditLogger');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const validation = authValidator.validateRegister(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    const userData = await userService.registerUser(req.body, { ipAddress, userAgent });
    return success(res, userData, 201);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  const ip = getClientIp(req);
  const email = req.body?.email;

  try {
    const validation = authValidator.validateLogin(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const ipAddress = ip;
    const userAgent = req.headers['user-agent'] || null;

    const userData = await userService.loginUser(req.body, { ipAddress, userAgent });

    // Clear failed attempts counter on login success
    recordLoginSuccess(ip, email);

    // Record login success in audit log
    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_LOGIN_SUCCESS,
      severity: 'info',
      actorId: userData.user?.id || userData.id,
      actorEmail: email,
      actorRole: userData.user?.role || userData.role,
      ipAddress: ip,
      targetResource: `user:${userData.user?.id || userData.id}`,
      outcome: 'success',
    });

    return success(res, userData, 200);
  } catch (err) {
    // Record failed attempt for rate limiting
    recordFailure(ip, email);

    // Record login failure in audit log
    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_LOGIN_FAILURE,
      severity: 'warn',
      actorEmail: email,
      ipAddress: ip,
      targetResource: `auth:${email}`,
      outcome: 'failure',
      details: { reason: err.message },
    });

    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.body?.refreshToken;
    if (!token) {
      return error(res, 'Refresh token is required', 400);
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    const tokens = await userService.refreshUserToken({
      refreshToken: token,
      ipAddress,
      userAgent,
    });

    return success(res, tokens, 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Log out user and revoke session
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const token = req.body?.refreshToken;
    const userId = req.user?._id;
    const result = await userService.logoutUser({ refreshToken: token, userId });

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_SESSION_REVOKED,
      severity: 'info',
      actorId: userId,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      ipAddress: getClientIp(req),
      targetResource: `user:${userId}`,
      outcome: 'success',
      details: { type: 'logout' },
    });

    return success(res, result, 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Revoke all active sessions for current user
 * POST /api/auth/revoke-all
 */
const revokeAll = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return error(res, 'Authentication required', 401);
    }
    const result = await userService.revokeAllUserSessions(req.user._id);

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_SESSION_REVOKED,
      severity: 'warn',
      actorId: req.user._id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      ipAddress: getClientIp(req),
      targetResource: `user:${req.user._id}`,
      outcome: 'success',
      details: { type: 'revoke_all' },
    });

    return success(res, result, 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  if (req.user) {
    return success(res, req.user, 200);
  }
  return error(res, 'Not authorized', 401);
};

/**
 * Update user role (Admin only)
 * PATCH /api/auth/users/:id/role
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const targetUserId = req.params.id;
    const updated = await userService.updateUserRole(req.user, targetUserId, role);

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_ROLE_CHANGED,
      severity: 'warn',
      actorId: req.user?._id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      ipAddress: getClientIp(req),
      targetResource: `user:${targetUserId}`,
      outcome: 'success',
      details: { targetUserId, newRole: role },
    });

    return success(res, updated, 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

/**
 * Query centralized security audit logs (Admin only)
 * GET /api/auth/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const result = await AuditLogger.queryLogs({
      user: req.user,
      filter: req.query,
      pagination: req.query,
    });
    return success(res, result, 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    return next(err);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  revokeAll,
  getMe,
  updateUserRole,
  getAuditLogs,
};

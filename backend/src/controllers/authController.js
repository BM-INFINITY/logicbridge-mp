const { userService } = require('../services');
const { authValidator } = require('../validators');
const { success, error } = require('../utils/ResponseHelper');
const { recordFailure, recordLoginSuccess, getClientIp } = require('../middleware/rateLimiter');

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

    return success(res, userData, 200);
  } catch (err) {
    // Record failed attempt for rate limiting
    recordFailure(ip, email);

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
    return success(res, updated, 200);
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
};

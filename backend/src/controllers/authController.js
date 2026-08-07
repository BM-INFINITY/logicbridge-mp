const { userService } = require('../services');
const { authValidator } = require('../validators');
const { success, error } = require('../utils/ResponseHelper');

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

    const userData = await userService.registerUser(req.body);
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
  try {
    const validation = authValidator.validateLogin(req.body);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const userData = await userService.loginUser(req.body);
    return success(res, userData, 200);
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
const getMe = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const jwt = require('jsonwebtoken');
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userService.getUserById(decoded.id);
      return success(res, user, 200);
    } catch (err) {
      return error(res, err.message || 'Invalid token', 401);
    }
  }
  return error(res, 'No token', 401);
};

module.exports = {
  register,
  login,
  getMe,
};

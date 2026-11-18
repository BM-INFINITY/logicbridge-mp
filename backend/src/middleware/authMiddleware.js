const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware: validates Bearer access token, checks session revocation via tokenVersion
 */
const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      token = authHeader.split(' ')[1].trim();
      const secret = process.env.JWT_SECRET || 'logicbridge_default_jwt_secret';
      const decoded = jwt.verify(token, secret);

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check session revocation: if token was issued prior to a session revocation event
      if (
        decoded.tokenVersion !== undefined &&
        user.tokenVersion !== undefined &&
        decoded.tokenVersion < user.tokenVersion
      ) {
        return res.status(401).json({ message: 'Session has been revoked. Please log in again.' });
      }

      req.user = user;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Permitted user roles (e.g. 'admin', 'approver')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const currentRole = req.user.role || 'user';
    if (!roles.includes(currentRole)) {
      return res.status(403).json({
        message: `Forbidden: Requires ${roles.join(' or ')} privilege`,
        requiredRoles: roles,
        currentRole,
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  requireRole,
};

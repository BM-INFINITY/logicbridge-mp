const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLogger = require('../services/AuditLogger');

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

      // Check session revocation: verify tokenVersion against persistent user record
      const userTokenVersion = user.tokenVersion || 0;
      const tokenVersion = decoded.tokenVersion;
      if (tokenVersion === undefined || tokenVersion < userTokenVersion) {
        return res.status(401).json({ message: 'Session has been revoked. Please log in again.' });
      }

      // Safe legacy default: Ensure missing legacy roles resolve safely to 'user'
      user.role = user.role || 'user';
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
      AuditLogger.recordEvent({
        eventType: AuditLogger.AuditEvents.AUTHORIZATION_FAILURE,
        severity: 'warn',
        actorId: req.user._id,
        actorEmail: req.user.email,
        actorRole: currentRole,
        ipAddress: req.ip || req.connection?.remoteAddress,
        targetResource: req.originalUrl,
        outcome: 'blocked',
        details: { requiredRoles: roles, currentRole },
      });

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

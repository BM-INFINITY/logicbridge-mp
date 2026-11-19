const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLogger = require('./AuditLogger');

// In-memory fallback for offline test environments
const memoryRefreshTokens = new Map();

/**
 * Derives a SHA-256 hash from a raw refresh token
 * @param {string} rawToken
 * @returns {string} Hex hash
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Generates a short-lived JWT access token
 * @param {object} user
 * @returns {string} JWT token string
 */
function generateAccessToken(user) {
  const payload = {
    id: String(user._id || user.id),
    role: user.role || 'user',
    tokenVersion: user.tokenVersion || 0,
  };
  const secret = process.env.JWT_SECRET || 'logicbridge_default_jwt_secret';
  const expiresIn = process.env.JWT_ACCESS_EXPIRATION || '15m';
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Generates and stores a new refresh token with rotation family tracking
 */
async function issueRefreshToken(user, ipAddress = null, userAgent = null, existingFamily = null) {
  const isProd = process.env.NODE_ENV === 'production';
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isProd && !isDbConnected) {
    const error = new Error('Database service unavailable for session persistence');
    error.statusCode = 503;
    throw error;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const family = existingFamily || crypto.randomUUID();
  const refreshTtlDays = parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || '7', 10);
  const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

  const tokenRecord = {
    userId: user._id || user.id,
    tokenHash,
    family,
    isRevoked: false,
    revokedAt: null,
    revokedReason: null,
    replacedByTokenHash: null,
    expiresAt,
    ipAddress,
    userAgent,
    createdAt: new Date(),
  };

  if (isDbConnected) {
    try {
      await RefreshToken.create(tokenRecord);
    } catch (dbErr) {
      if (isProd) {
        const error = new Error(`Database error saving refresh token: ${dbErr.message}`);
        error.statusCode = 503;
        throw error;
      }
    }
  }

  // Memory fallback only permitted in development / offline test mode
  if (!isProd) {
    memoryRefreshTokens.set(tokenHash, tokenRecord);
  }

  return rawToken;
}

/**
 * Register a new user
 * Enforces role: 'user' to prevent privilege escalation
 */
async function registerUser({ name, email, password }, meta = {}) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const exists = await User.findOne({ email: cleanEmail });
  if (exists) {
    const error = new Error('Email already registered');
    error.statusCode = 400;
    throw error;
  }

  // Force role to 'user' regardless of incoming payload
  const user = await User.create({
    name,
    email: cleanEmail,
    password,
    role: 'user',
    tokenVersion: 0,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = await issueRefreshToken(user, meta.ipAddress, meta.userAgent);

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: 'user',
    token: accessToken,
    accessToken,
    refreshToken,
  };
}

/**
 * Authenticate user credentials with brute-force lockout protection
 */
async function loginUser({ email, password }, meta = {}) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const user = await User.findOne({ email: cleanEmail });

  // Account lockout window check
  if (user && user.lockUntil && user.lockUntil > new Date()) {
    const remainingMs = user.lockUntil.getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / (60 * 1000));
    const error = new Error(`Account temporarily locked due to excessive failed attempts. Please try again in ${remainingMins} minute(s).`);
    error.statusCode = 429;
    throw error;
  }

  if (!user || !(await user.matchPassword(password))) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const maxAttempts = parseInt(process.env.AUTH_MAX_ACCOUNT_FAILED_ATTEMPTS || '5', 10);
      if (user.failedLoginAttempts >= maxAttempts) {
        const lockDurationMs = parseInt(process.env.AUTH_ACCOUNT_LOCK_WINDOW_MS || String(15 * 60 * 1000), 10);
        user.lockUntil = new Date(Date.now() + lockDurationMs);
        user.failedLoginAttempts = 0;
      }
      await user.save().catch(() => {});
    }

    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  // Reset failed login attempts on successful authentication
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save().catch(() => {});
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await issueRefreshToken(user, meta.ipAddress, meta.userAgent);

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    token: accessToken,
    accessToken,
    refreshToken,
  };
}

/**
 * Rotate refresh token and issue new access token with reuse detection
 */
async function refreshUserToken({ refreshToken, ipAddress = null, userAgent = null }) {
  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    throw error;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isProd && !isDbConnected) {
    const error = new Error('Database service unavailable');
    error.statusCode = 503;
    throw error;
  }

  const tokenHash = hashToken(refreshToken.trim());
  const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
  const newHash = hashToken(newRawRefreshToken);
  const refreshTtlDays = parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || '7', 10);
  const newExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

  let user = null;
  let family = null;

  if (isDbConnected) {
    let rotatedDoc = null;
    try {
      // Atomic Compare-And-Swap (CAS): Only succeeds if token exists, is NOT revoked, and not expired
      rotatedDoc = await RefreshToken.findOneAndUpdate(
        { tokenHash, isRevoked: false, expiresAt: { $gt: new Date() } },
        {
          $set: {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'Rotated',
            replacedByTokenHash: newHash,
          },
        },
        { new: false }
      );
    } catch (dbErr) {
      if (isProd) {
        const error = new Error(`Database error during token refresh: ${dbErr.message}`);
        error.statusCode = 503;
        throw error;
      }
    }

    if (!rotatedDoc) {
      // The token was not updated: check if it already existed and was revoked (reuse detection)
      let existing = null;
      try {
        existing = await RefreshToken.findOne({ tokenHash });
      } catch (dbErr) {
        if (isProd) {
          const error = new Error(`Database error checking token: ${dbErr.message}`);
          error.statusCode = 503;
          throw error;
        }
      }

      if (existing) {
        if (existing.isRevoked) {
          // Token reuse detected! Revoke entire family across DB and memory
          const compromisedFamily = existing.family;
          try {
            await RefreshToken.updateMany(
              { family: compromisedFamily },
              { $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'Token reuse detected' } }
            );
          } catch {}

          for (const [, rec] of memoryRefreshTokens.entries()) {
            if (rec.family === compromisedFamily) {
              rec.isRevoked = true;
              rec.revokedAt = new Date();
              rec.revokedReason = 'Token reuse detected';
            }
          }

          AuditLogger.recordEvent({
            eventType: AuditLogger.AuditEvents.AUTH_REFRESH_TOKEN_REUSE_DETECTED,
            severity: 'critical',
            actorId: existing?.userId ? String(existing.userId) : null,
            ipAddress,
            targetResource: `family:${compromisedFamily}`,
            outcome: 'blocked',
            details: { family: compromisedFamily, revokedReason: 'Token reuse detected' },
          });

          const error = new Error('Security Alert: Compromised refresh token reuse detected. Session terminated.');
          error.statusCode = 401;
          throw error;
        }

        if (existing.expiresAt <= new Date()) {
          const error = new Error('Refresh token has expired. Please log in again.');
          error.statusCode = 401;
          throw error;
        }
      }

      // If not in DB, in non-production check memory store
      if (!isProd && memoryRefreshTokens.has(tokenHash)) {
        const memDoc = memoryRefreshTokens.get(tokenHash);
        if (memDoc.isRevoked) {
          const memFamily = memDoc.family;
          for (const [, rec] of memoryRefreshTokens.entries()) {
            if (rec.family === memFamily) {
              rec.isRevoked = true;
              rec.revokedAt = new Date();
              rec.revokedReason = 'Token reuse detected';
            }
          }
          const error = new Error('Security Alert: Compromised refresh token reuse detected. Session terminated.');
          error.statusCode = 401;
          throw error;
        }
        if (new Date(memDoc.expiresAt) <= new Date()) {
          const error = new Error('Refresh token has expired. Please log in again.');
          error.statusCode = 401;
          throw error;
        }

        memDoc.isRevoked = true;
        memDoc.revokedAt = new Date();
        memDoc.revokedReason = 'Rotated';
        memDoc.replacedByTokenHash = newHash;
        family = memDoc.family;

        user = await User.findById(memDoc.userId);
      } else {
        const error = new Error('Invalid or expired refresh token');
        error.statusCode = 401;
        throw error;
      }
    } else {
      family = rotatedDoc.family;
      user = await User.findById(rotatedDoc.userId);
    }

    if (!user) {
      const error = new Error('User associated with refresh token no longer exists');
      error.statusCode = 401;
      throw error;
    }

    const newTokenRecord = {
      userId: user._id,
      tokenHash: newHash,
      family,
      isRevoked: false,
      revokedAt: null,
      revokedReason: null,
      replacedByTokenHash: null,
      expiresAt: newExpiresAt,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };

    try {
      await RefreshToken.create(newTokenRecord);
    } catch (dbErr) {
      if (isProd) {
        const error = new Error(`Database error saving rotated token: ${dbErr.message}`);
        error.statusCode = 503;
        throw error;
      }
    }

    if (!isProd) {
      memoryRefreshTokens.set(newHash, newTokenRecord);
    }

    AuditLogger.recordEvent({
      eventType: AuditLogger.AuditEvents.AUTH_REFRESH_TOKEN_ROTATED,
      severity: 'info',
      actorId: String(user._id),
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      targetResource: `user:${user._id}`,
      outcome: 'success',
      details: { family },
    });

    const newAccessToken = generateAccessToken(user);
    return {
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  // Non-production offline memory-only mode
  const memDoc = memoryRefreshTokens.get(tokenHash);
  if (!memDoc) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  if (memDoc.isRevoked) {
    const memFamily = memDoc.family;
    for (const [, rec] of memoryRefreshTokens.entries()) {
      if (rec.family === memFamily) {
        rec.isRevoked = true;
        rec.revokedAt = new Date();
        rec.revokedReason = 'Token reuse detected';
      }
    }
    const error = new Error('Security Alert: Compromised refresh token reuse detected. Session terminated.');
    error.statusCode = 401;
    throw error;
  }

  if (new Date(memDoc.expiresAt) <= new Date()) {
    const error = new Error('Refresh token has expired. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  memDoc.isRevoked = true;
  memDoc.revokedAt = new Date();
  memDoc.revokedReason = 'Rotated';
  memDoc.replacedByTokenHash = newHash;

  user = await User.findById(memDoc.userId);
  if (!user) {
    const error = new Error('User associated with refresh token no longer exists');
    error.statusCode = 401;
    throw error;
  }

  const newTokenRecord = {
    userId: user._id,
    tokenHash: newHash,
    family: memDoc.family,
    isRevoked: false,
    revokedAt: null,
    revokedReason: null,
    replacedByTokenHash: null,
    expiresAt: newExpiresAt,
    ipAddress,
    userAgent,
    createdAt: new Date(),
  };

  memoryRefreshTokens.set(newHash, newTokenRecord);
  const newAccessToken = generateAccessToken(user);

  return {
    token: newAccessToken,
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
}

/**
 * Log out and revoke active refresh token session
 */
async function logoutUser({ refreshToken, userId }) {
  const isProd = process.env.NODE_ENV === 'production';
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isProd && !isDbConnected) {
    const error = new Error('Database service unavailable');
    error.statusCode = 503;
    throw error;
  }

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken.trim());
    if (isDbConnected) {
      try {
        await RefreshToken.updateOne(
          { tokenHash },
          { isRevoked: true, revokedAt: new Date(), revokedReason: 'User logout' }
        );
      } catch (dbErr) {
        if (isProd) {
          const error = new Error(`Database error during logout: ${dbErr.message}`);
          error.statusCode = 503;
          throw error;
        }
      }
    }

    if (!isProd && memoryRefreshTokens.has(tokenHash)) {
      const rec = memoryRefreshTokens.get(tokenHash);
      rec.isRevoked = true;
      rec.revokedAt = new Date();
      rec.revokedReason = 'User logout';
    }
  }

  return { success: true, message: 'Logged out successfully' };
}

/**
 * Revoke all active sessions for a user (e.g. password change, security compromise)
 */
async function revokeAllUserSessions(userId) {
  const isProd = process.env.NODE_ENV === 'production';
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isProd && !isDbConnected) {
    const error = new Error('Database service unavailable');
    error.statusCode = 503;
    throw error;
  }

  const uid = String(userId);

  if (isDbConnected) {
    try {
      await RefreshToken.updateMany(
        { userId: uid },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'Revoke all sessions' }
      );
    } catch (dbErr) {
      if (isProd) {
        const error = new Error(`Database error revoking sessions: ${dbErr.message}`);
        error.statusCode = 503;
        throw error;
      }
    }
  }

  if (!isProd) {
    for (const [, rec] of memoryRefreshTokens.entries()) {
      if (String(rec.userId) === uid) {
        rec.isRevoked = true;
        rec.revokedAt = new Date();
        rec.revokedReason = 'Revoke all sessions';
      }
    }
  }

  // Increment tokenVersion on user document to immediately invalidate all access tokens
  const user = await User.findById(uid);
  if (user) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
  }

  return { success: true, message: 'All active sessions have been revoked' };
}

/**
 * Update user role (Admin only)
 * Increments tokenVersion to immediately revoke old sessions and require re-authentication with new role
 */
async function updateUserRole(adminUser, targetUserId, newRole) {
  if (!adminUser || adminUser.role !== 'admin') {
    const error = new Error('Forbidden: Only administrators can modify user roles');
    error.statusCode = 403;
    throw error;
  }

  const validRoles = ['user', 'admin', 'approver'];
  if (!newRole || !validRoles.includes(newRole)) {
    const error = new Error(`Invalid role "${newRole}". Supported roles: ${validRoles.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.role = newRole;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  AuditLogger.recordEvent({
    eventType: AuditLogger.AuditEvents.AUTH_ROLE_CHANGED,
    severity: 'warn',
    actorId: String(adminUser._id),
    actorEmail: adminUser.email,
    actorRole: adminUser.role,
    targetResource: `user:${targetUserId}`,
    outcome: 'success',
    details: { targetUserId, newRole },
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Get user profile by ID
 */
async function getUserById(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 401;
    throw error;
  }
  return user;
}

function _clearMemoryRefreshTokens() {
  memoryRefreshTokens.clear();
}

module.exports = {
  generateAccessToken,
  issueRefreshToken,
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  revokeAllUserSessions,
  updateUserRole,
  getUserById,
  hashToken,
  _memoryRefreshTokens: memoryRefreshTokens,
  _clearMemoryRefreshTokens,
};

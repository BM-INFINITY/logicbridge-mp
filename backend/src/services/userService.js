const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

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

  // Always keep in memory store
  memoryRefreshTokens.set(tokenHash, tokenRecord);

  // If Mongo is connected, persist to DB
  if (mongoose.connection.readyState === 1) {
    try {
      await RefreshToken.create(tokenRecord);
    } catch {
      // Fallback stays in memoryRefreshTokens
    }
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

  const tokenHash = hashToken(refreshToken.trim());
  let tokenDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      tokenDoc = await RefreshToken.findOne({ tokenHash });
    } catch {
      tokenDoc = null;
    }
  }

  if (!tokenDoc && memoryRefreshTokens.has(tokenHash)) {
    tokenDoc = memoryRefreshTokens.get(tokenHash);
  }

  if (!tokenDoc) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  // Check expiration
  if (new Date(tokenDoc.expiresAt) < new Date()) {
    const error = new Error('Refresh token has expired. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  // Token reuse detection: if a revoked refresh token is presented, revoke its entire family!
  if (tokenDoc.isRevoked) {
    const family = tokenDoc.family;
    // Revoke all in memory
    for (const [h, rec] of memoryRefreshTokens.entries()) {
      if (rec.family === family) {
        rec.isRevoked = true;
        rec.revokedAt = new Date();
        rec.revokedReason = 'Token reuse detected';
      }
    }
    // Revoke all in DB
    if (mongoose.connection.readyState === 1) {
      await RefreshToken.updateMany(
        { family },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'Token reuse detected' }
      ).catch(() => {});
    }

    const error = new Error('Security Alert: Compromised refresh token reuse detected. Session terminated.');
    error.statusCode = 401;
    throw error;
  }

  // Find user
  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    const error = new Error('User associated with refresh token no longer exists');
    error.statusCode = 401;
    throw error;
  }

  // Mark current token as revoked and rotated
  tokenDoc.isRevoked = true;
  tokenDoc.revokedAt = new Date();
  tokenDoc.revokedReason = 'Rotated';

  const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
  const newHash = hashToken(newRawRefreshToken);
  tokenDoc.replacedByTokenHash = newHash;

  if (tokenDoc.save) {
    await tokenDoc.save().catch(() => {});
  }

  // Save new refresh token in same family
  const refreshTtlDays = parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || '7', 10);
  const newExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
  const newTokenRecord = {
    userId: user._id,
    tokenHash: newHash,
    family: tokenDoc.family,
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
  if (mongoose.connection.readyState === 1) {
    await RefreshToken.create(newTokenRecord).catch(() => {});
  }

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
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken.trim());
    if (memoryRefreshTokens.has(tokenHash)) {
      const rec = memoryRefreshTokens.get(tokenHash);
      rec.isRevoked = true;
      rec.revokedAt = new Date();
      rec.revokedReason = 'User logout';
    }

    if (mongoose.connection.readyState === 1) {
      await RefreshToken.updateOne(
        { tokenHash },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'User logout' }
      ).catch(() => {});
    }
  }

  return { success: true, message: 'Logged out successfully' };
}

/**
 * Revoke all active sessions for a user (e.g. password change, security compromise)
 */
async function revokeAllUserSessions(userId) {
  const uid = String(userId);

  // Invalidate in memory
  for (const [, rec] of memoryRefreshTokens.entries()) {
    if (String(rec.userId) === uid) {
      rec.isRevoked = true;
      rec.revokedAt = new Date();
      rec.revokedReason = 'Revoke all sessions';
    }
  }

  // Invalidate in DB
  if (mongoose.connection.readyState === 1) {
    await RefreshToken.updateMany(
      { userId: uid },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'Revoke all sessions' }
    ).catch(() => {});
  }

  // Increment tokenVersion on user document to immediately invalidate all access tokens
  const user = await User.findById(uid);
  if (user) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save().catch(() => {});
  }

  return { success: true, message: 'All active sessions have been revoked' };
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

module.exports = {
  generateAccessToken,
  issueRefreshToken,
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  revokeAllUserSessions,
  getUserById,
  hashToken,
  _memoryRefreshTokens: memoryRefreshTokens,
};

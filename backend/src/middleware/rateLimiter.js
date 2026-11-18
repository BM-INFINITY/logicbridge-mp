/**
 * Authentication Rate Limiting Middleware (SEC-08)
 *
 * Provides layered brute-force protection across:
 *   1. Client IP address
 *   2. Target user account (normalized email)
 *
 * Configurable thresholds via environment variables with safe defaults.
 * Returns consistent, non-revealing errors with Retry-After header.
 */

const ipAttemptStore = new Map();     // ip -> { count, firstAttempt, lockedUntil }
const accountAttemptStore = new Map();  // email -> { count, firstAttempt, lockedUntil }

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

function getLoginConfig() {
  return {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000, // 15 mins
    maxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || '', 10) || 5,        // 5 attempts
    lockoutDurationMs: parseInt(process.env.AUTH_LOCKOUT_DURATION_MS || '', 10) || 15 * 60 * 1000,
  };
}

function getRegisterConfig() {
  return {
    windowMs: parseInt(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS || '', 10) || 60 * 60 * 1000, // 1 hour
    maxAttempts: parseInt(process.env.AUTH_REGISTER_RATE_LIMIT_MAX_ATTEMPTS || '', 10) || 10,        // 10 registrations
  };
}

/**
 * Checks and updates rate limit record for a given key
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
function checkLimit(store, key, maxAttempts, windowMs, lockoutDurationMs) {
  const now = Date.now();
  let record = store.get(key);

  if (!record) {
    record = { count: 0, firstAttempt: now, lockedUntil: 0 };
    store.set(key, record);
  }

  // Check if currently locked
  if (record.lockedUntil > now) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  // Reset if window has elapsed
  if (now - record.firstAttempt > windowMs) {
    record.count = 0;
    record.firstAttempt = now;
    record.lockedUntil = 0;
  }

  if (record.count >= maxAttempts) {
    record.lockedUntil = now + lockoutDurationMs;
    const retryAfterSec = Math.ceil(lockoutDurationMs / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Records a failed attempt for an IP and account
 */
function recordFailure(ip, email) {
  const now = Date.now();
  const config = getLoginConfig();

  // Increment IP
  let ipRec = ipAttemptStore.get(ip);
  if (!ipRec) {
    ipRec = { count: 1, firstAttempt: now, lockedUntil: 0 };
    ipAttemptStore.set(ip, ipRec);
  } else {
    ipRec.count += 1;
    if (ipRec.count >= config.maxAttempts) {
      ipRec.lockedUntil = now + config.lockoutDurationMs;
    }
  }

  // Increment Account
  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    let accRec = accountAttemptStore.get(cleanEmail);
    if (!accRec) {
      accRec = { count: 1, firstAttempt: now, lockedUntil: 0 };
      accountAttemptStore.set(cleanEmail, accRec);
    } else {
      accRec.count += 1;
      if (accRec.count >= config.maxAttempts) {
        accRec.lockedUntil = now + config.lockoutDurationMs;
      }
    }
  }
}

/**
 * Clears failed attempt counters upon successful authentication
 */
function recordLoginSuccess(ip, email) {
  if (ip) ipAttemptStore.delete(ip);
  if (email) accountAttemptStore.delete(String(email).toLowerCase().trim());
}

/**
 * Rate limiter middleware for login endpoints
 */
function loginRateLimiter(req, res, next) {
  const config = getLoginConfig();
  const ip = getClientIp(req);
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';

  // 1. Check IP rate limit
  const ipCheck = checkLimit(ipAttemptStore, ip, config.maxAttempts, config.windowMs, config.lockoutDurationMs);
  if (!ipCheck.allowed) {
    res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
    return res.status(429).json({
      message: 'Too many failed login attempts from this IP address. Please try again later.',
      retryAfter: ipCheck.retryAfterSec,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  // 2. Check Account rate limit
  if (email) {
    const accCheck = checkLimit(accountAttemptStore, email, config.maxAttempts, config.windowMs, config.lockoutDurationMs);
    if (!accCheck.allowed) {
      res.setHeader('Retry-After', String(accCheck.retryAfterSec));
      return res.status(429).json({
        message: 'Too many failed login attempts for this account. Please try again later.',
        retryAfter: accCheck.retryAfterSec,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }
  }

  return next();
}

/**
 * Rate limiter middleware for registration endpoints
 */
function registerRateLimiter(req, res, next) {
  const config = getRegisterConfig();
  const ip = getClientIp(req);

  const ipCheck = checkLimit(ipAttemptStore, ip, config.maxAttempts, config.windowMs, config.windowMs);
  if (!ipCheck.allowed) {
    res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
    return res.status(429).json({
      message: 'Too many accounts registered from this IP address. Please try again later.',
      retryAfter: ipCheck.retryAfterSec,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  // Increment registration count
  let record = ipAttemptStore.get(ip);
  if (record) {
    record.count += 1;
  }

  return next();
}

/**
 * Testing utility to reset all stores
 */
function resetRateLimits() {
  ipAttemptStore.clear();
  accountAttemptStore.clear();
}

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
  recordFailure,
  recordLoginSuccess,
  resetRateLimits,
  getClientIp,
};

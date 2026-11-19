const express = require('express');
const { authController } = require('../controllers');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { loginRateLimiter, registerRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/register (rate limited)
router.post('/register', registerRateLimiter, authController.register);

// POST /api/auth/login (rate limited with brute-force lockout)
router.post('/login', loginRateLimiter, authController.login);

// POST /api/auth/refresh (rotate refresh token)
router.post('/refresh', authController.refreshToken);

// POST /api/auth/logout (revoke refresh token)
router.post('/logout', protect, authController.logout);

// POST /api/auth/revoke-all (revoke all active sessions)
router.post('/revoke-all', protect, authController.revokeAll);

// GET /api/auth/me (authenticated user profile)
router.get('/me', protect, authController.getMe);

// PATCH /api/auth/users/:id/role (Admin only role management)
router.patch('/users/:id/role', protect, requireRole('admin'), authController.updateUserRole);

// GET /api/auth/audit-logs (Admin only security audit log querying)
router.get('/audit-logs', protect, requireRole('admin'), authController.getAuditLogs);

module.exports = router;

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const oauthController = require('../controllers/oauthController');

const router = express.Router();

// GET /api/oauth/google — initiate Google OAuth (redirect to consent screen)
router.get('/google', protect, oauthController.initiateGoogleAuth);

// GET /api/oauth/google/url — get OAuth URL as JSON (for SPA)
router.get('/google/url', protect, oauthController.getGoogleAuthUrl);

// GET /api/oauth/google/callback — Google redirects here after authorization
// Note: this route is NOT protected by JWT — Google sends users here directly
router.get('/google/callback', oauthController.googleCallback);

// POST /api/oauth/google/disconnect — revoke and delete Gmail connection
router.post('/google/disconnect', protect, oauthController.disconnectGoogle);

module.exports = router;

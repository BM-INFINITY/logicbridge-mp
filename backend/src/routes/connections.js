const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { connectionController } = require('../controllers');

const router = express.Router();

// GET /api/connections/providers — must be before /:id routes
router.get('/providers', protect, connectionController.listProviders);

// GET /api/connections — list all user connections
router.get('/', protect, connectionController.getConnections);

// POST /api/connections — create new connection
router.post('/', protect, connectionController.createConnection);

// GET /api/connections/:id — get single connection
router.get('/:id', protect, connectionController.getConnection);

// PUT /api/connections/:id — update connection
router.put('/:id', protect, connectionController.updateConnection);

// DELETE /api/connections/:id — delete connection
router.delete('/:id', protect, connectionController.deleteConnection);

// POST /api/connections/:id/verify — verify connection status
router.post('/:id/verify', protect, connectionController.verifyConnection);

module.exports = router;

const express = require('express');
const mongoose = require('mongoose');
const lifecycleManager = require('../services/lifecycleManager');

const router = express.Router();

/**
 * GET /api/health
 * Backward-compatible lightweight health probe.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'LogicBridge API',
  });
});

/**
 * GET /api/health/live
 * Kubernetes / Container Liveness Probe.
 * Verifies that the process is running and able to handle HTTP events.
 * Does NOT fail if external dependencies (like MongoDB) are temporarily degraded.
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    check: 'liveness',
    service: 'LogicBridge API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Kubernetes / Load Balancer Readiness Probe.
 * Verifies that the instance is ready to receive and execute workflows:
 * 1. Checks application is not undergoing graceful shutdown.
 * 2. Checks database connectivity (MongoDB readyState === 1).
 * Returns HTTP 200 when ready, HTTP 503 when unavailable.
 * Never leaks database connection strings, credentials, or internal topology.
 */
router.get('/ready', (req, res) => {
  // Check if server is currently draining connections for shutdown
  if (lifecycleManager.isShuttingDown()) {
    return res.status(503).json({
      status: 'unavailable',
      check: 'readiness',
      message: 'Server is undergoing graceful shutdown',
      database: 'draining',
    });
  }

  // Check MongoDB connection state: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (!isDbConnected) {
    return res.status(503).json({
      status: 'unavailable',
      check: 'readiness',
      message: 'Database connection is not ready',
      database: 'disconnected',
    });
  }

  return res.status(200).json({
    status: 'ok',
    check: 'readiness',
    database: 'connected',
    scheduler: 'active',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

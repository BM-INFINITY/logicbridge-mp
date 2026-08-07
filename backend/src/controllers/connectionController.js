const ConnectionService = require('../services/ConnectionService');
const { connectionRegistry } = require('../providers/connections');
const { success, error } = require('../utils/ResponseHelper');

/**
 * GET /api/connections
 * Returns all connections owned by the authenticated user.
 */
const getConnections = async (req, res, next) => {
  try {
    const connections = await ConnectionService.getConnectionsByOwner(req.user._id);
    return success(res, connections);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/connections
 * Create and verify a new connection.
 * Body: { provider, name, credentials: { ... } }
 */
const createConnection = async (req, res, next) => {
  try {
    const { provider, name, credentials } = req.body;
    if (!provider || !name) {
      return error(res, 'provider and name are required', 422);
    }
    const conn = await ConnectionService.createConnection({
      ownerId: req.user._id,
      provider,
      name,
      credentials: credentials || {},
    });
    return success(res, conn, 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * GET /api/connections/:id
 * Returns a single connection (no credentials).
 */
const getConnection = async (req, res, next) => {
  try {
    const conn = await ConnectionService.getConnectionById(req.params.id, req.user._id);
    return success(res, conn);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * PUT /api/connections/:id
 * Update connection name or credentials.
 * Body: { name?, credentials? }
 */
const updateConnection = async (req, res, next) => {
  try {
    const conn = await ConnectionService.updateConnection(
      req.params.id,
      req.user._id,
      req.body
    );
    return success(res, conn);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * DELETE /api/connections/:id
 */
const deleteConnection = async (req, res, next) => {
  try {
    const result = await ConnectionService.deleteConnection(req.params.id, req.user._id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * POST /api/connections/:id/verify
 * Re-verify a connection and update its status.
 */
const verifyConnection = async (req, res, next) => {
  try {
    const result = await ConnectionService.verifyConnection(req.params.id, req.user._id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    return next(err);
  }
};

/**
 * GET /api/connections/providers
 * Returns metadata for all registered providers (drives Connections UI).
 */
const listProviders = async (req, res, next) => {
  try {
    const providers = connectionRegistry.listMetadata();
    return success(res, providers);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getConnections,
  createConnection,
  getConnection,
  updateConnection,
  deleteConnection,
  verifyConnection,
  listProviders,
};

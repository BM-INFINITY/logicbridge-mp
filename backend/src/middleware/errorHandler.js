const { ConfigurationError, ValidationError, NodeExecutionError } = require('../errors');

/**
 * Global Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[Express ErrorHandler] ${err.name || 'Error'}: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({ message: err.message, field: err.field });
  }

  if (err instanceof ConfigurationError) {
    return res.status(500).json({ message: `System Configuration Error: ${err.message}` });
  }

  if (err instanceof NodeExecutionError) {
    return res.status(500).json({ message: err.message, nodeId: err.nodeId });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;

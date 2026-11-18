const crypto = require('crypto');
const { ConfigurationError, ValidationError, NodeExecutionError } = require('../errors');

/**
 * Sanitizes potentially sensitive details (filesystem paths, connection strings, secrets)
 * from client-facing error messages.
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred';
  let clean = msg;
  // Mask Windows & POSIX filesystem paths
  clean = clean.replace(/[A-Za-z]:\\[^"'\n\r\t<>]+/g, '[REDACTED_PATH]');
  clean = clean.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[REDACTED_PATH]');
  // Mask MongoDB & database connection strings
  clean = clean.replace(/(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"']+/gi, '[REDACTED_URI]');
  // Mask API keys and bearer tokens
  clean = clean.replace(/(?:sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_SECRET]');
  return clean;
}

/**
 * Global Express Error Handling Middleware (SEC-12)
 *
 * In production, strictly prevents internal error disclosure:
 *   - 5xx errors return generic, non-revealing messages with an error ID
 *   - Internal stack traces, database internals, and filesystem paths are withheld
 *   - Server-side console logs retain complete diagnostics for debugging
 *   - Validation and expected business errors (4xx) retain safe, sanitized messages
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const errorId = crypto.randomBytes(8).toString('hex');
  const statusCode = err.statusCode || (err instanceof ValidationError ? 400 : 500);

  // Preserve full detailed diagnostics in protected server logs
  console.error(`[Express ErrorHandler] [${errorId}] ${req.method} ${req.originalUrl || req.url} -> ${err.name || 'Error'}: ${err.message}`);
  if (err.stack) {
    console.error(`[Express ErrorHandler] [${errorId}] Stack:\n${err.stack}`);
  }

  // 1. Validation Errors (Client input errors, 400 Bad Request)
  if (err instanceof ValidationError || statusCode === 400) {
    return res.status(400).json({
      message: sanitizeErrorMessage(err.message || 'Validation failed'),
      field: err.field || undefined,
      code: 'VALIDATION_ERROR',
    });
  }

  // 2. Client Authentication & Authorization Errors (401, 403, 404, 409, 429)
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({
      message: sanitizeErrorMessage(err.message || 'Request failed'),
      code: err.code || 'CLIENT_ERROR',
    });
  }

  // 3. Server-side Internal Errors (5xx)
  if (isProd) {
    // In production, NEVER expose internal error messages, system paths, or configuration details
    return res.status(500).json({
      message: 'An internal server error occurred',
      code: 'INTERNAL_SERVER_ERROR',
      errorId,
    });
  }

  // In development and testing, provide detailed messages for debugging
  if (err instanceof ConfigurationError) {
    return res.status(500).json({
      message: `System Configuration Error: ${err.message}`,
      errorId,
    });
  }

  if (err instanceof NodeExecutionError) {
    return res.status(500).json({
      message: err.message,
      nodeId: err.nodeId,
      errorId,
    });
  }

  return res.status(statusCode).json({
    message: err.message || 'Internal server error',
    errorId,
  });
}

module.exports = errorHandler;

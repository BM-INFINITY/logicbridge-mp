const crypto = require('crypto');
const { ConfigurationError, ValidationError, NodeExecutionError } = require('../errors');

/**
 * Sanitizes potentially sensitive details (filesystem paths, connection strings, secrets)
 * from client-facing error messages.
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred';
  let clean = msg;
  // Mask MongoDB & database connection strings first before path matching
  clean = clean.replace(/(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"']+/gi, '[REDACTED_URI]');
  // Mask API keys and bearer tokens
  clean = clean.replace(/(?:sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_SECRET]');
  // Mask Windows & POSIX filesystem paths
  clean = clean.replace(/[A-Za-z]:\\[^"'\n\r\t<>\s]+/g, '[REDACTED_PATH]');
  clean = clean.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[REDACTED_PATH]');
  return clean;
}

/**
 * Global Express Error Handling Middleware (UX & Production Standard)
 *
 * Enforces standardized JSON error envelopes:
 * {
 *   success: false,
 *   message: string,
 *   error: {
 *     code: string,
 *     message: string,
 *     details: Array<{ field?: string, message: string }>,
 *     requestId?: string
 *   }
 * }
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const requestId = req.id || req.headers?.['x-request-id'] || crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', requestId);

  // Ensure CORS headers are retained on error responses for allowed origins
  if (!res.getHeader('Access-Control-Allow-Origin') && req.headers?.origin) {
    const origin = req.headers.origin;
    const PRODUCTION_ORIGIN = 'https://logicbridge-mp.vercel.app';
    const allowed = [
      PRODUCTION_ORIGIN,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8080',
      ...(process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()),
      ...(process.env.CLIENT_URL || '').split(',').map((o) => o.trim()),
      ...(process.env.FRONTEND_URL || '').split(',').map((o) => o.trim()),
    ].filter(Boolean);

    const norm = origin.trim().replace(/\/+$/, '').toLowerCase();
    const isAllowed = allowed.some((a) => a.trim().replace(/\/+$/, '').toLowerCase() === norm);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  // Diagnostic server logging (preserves full diagnostics, redacting auth headers)
  const logPrefix = `[Express ErrorHandler] [${requestId}] ${req.method} ${req.originalUrl || req.url}`;
  console.error(`${logPrefix} -> ${err.name || 'Error'}: ${err.message}`);
  if (err.stack) {
    console.error(`${logPrefix} Stack:\n${err.stack}`);
  }

  // Helper builder for uniform response envelope
  const sendErrorResponse = (status, code, message, details = []) => {
    const safeMessage = sanitizeErrorMessage(message);
    return res.status(status).json({
      success: false,
      message: safeMessage,
      error: {
        code,
        message: safeMessage,
        details: Array.isArray(details) ? details : (details ? [details] : []),
        requestId,
      },
    });
  };

  // 1. JSON Body Parsing Syntax Error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendErrorResponse(400, 'INVALID_JSON_BODY', 'Malformed JSON payload in request body');
  }

  // 2. Mongoose Schema Validation Error
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.entries(err.errors).map(([field, errObj]) => ({
      field,
      message: sanitizeErrorMessage(errObj.message || `Validation failed on ${field}`),
    }));
    const summary = details.length > 0 ? details[0].message : 'Validation failed';
    return sendErrorResponse(400, 'VALIDATION_ERROR', summary, details);
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    const field = err.path || 'id';
    return sendErrorResponse(400, 'INVALID_IDENTIFIER', `Invalid format for ${field}`, [
      { field, message: `Value "${err.value}" is not a valid identifier format` },
    ]);
  }

  // 4. MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000 || (err.message && err.message.includes('E11000 duplicate key error'))) {
    const keys = err.keyValue ? Object.keys(err.keyValue) : [];
    const field = keys[0] || 'resource';
    const msg = `An item with this ${field} already exists`;
    return sendErrorResponse(409, 'RESOURCE_CONFLICT', msg, [
      { field, message: msg },
    ]);
  }

  // 5. Custom App ValidationError
  if (err instanceof ValidationError) {
    const details = err.field ? [{ field: err.field, message: err.message }] : [];
    return sendErrorResponse(400, 'VALIDATION_ERROR', err.message || 'Validation failed', details);
  }

  // 6. Custom App NodeExecutionError
  if (err instanceof NodeExecutionError) {
    return sendErrorResponse(
      500,
      'NODE_EXECUTION_ERROR',
      isProd ? `Step execution failed. Reference: ${requestId}` : err.message,
      err.nodeId ? [{ field: 'nodeId', message: err.nodeId }] : []
    );
  }

  // 7. Custom App ConfigurationError
  if (err instanceof ConfigurationError) {
    return sendErrorResponse(
      500,
      'CONFIGURATION_ERROR',
      isProd ? `System configuration issue. Reference: ${requestId}` : `System Configuration Error: ${err.message}`
    );
  }

  // 8. Expected Client Errors (4xx)
  const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);
  if (statusCode >= 400 && statusCode < 500) {
    const defaultCode =
      statusCode === 400
        ? 'VALIDATION_ERROR'
        : statusCode === 401
        ? 'AUTHENTICATION_REQUIRED'
        : statusCode === 403
        ? 'PERMISSION_DENIED'
        : statusCode === 404
        ? 'RESOURCE_NOT_FOUND'
        : statusCode === 409
        ? 'RESOURCE_CONFLICT'
        : statusCode === 422
        ? 'UNPROCESSABLE_ENTITY'
        : statusCode === 429
        ? 'RATE_LIMIT_EXCEEDED'
        : 'CLIENT_ERROR';

    const details = err.field ? [{ field: err.field, message: err.message }] : [];
    return sendErrorResponse(statusCode, err.code || defaultCode, err.message || 'Request failed', details);
  }

  // 9. Internal Server Errors (5xx)
  if (isProd) {
    return sendErrorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      `Something went wrong. Please try again. Reference: ${requestId}`
    );
  }

  // In non-production, return detailed message for developer troubleshooting
  return sendErrorResponse(statusCode, 'INTERNAL_SERVER_ERROR', err.message || 'Internal server error');
}

module.exports = errorHandler;

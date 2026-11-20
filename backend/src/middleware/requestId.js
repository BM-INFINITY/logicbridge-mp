const crypto = require('crypto');

/**
 * Request ID middleware
 * Assigns or propagates a unique correlation ID for every incoming request.
 * Sets X-Request-Id header on both request and response.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-idempotency-key'];

  const requestId = typeof incomingId === 'string' && incomingId.trim()
    ? incomingId.trim()
    : crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = requestIdMiddleware;

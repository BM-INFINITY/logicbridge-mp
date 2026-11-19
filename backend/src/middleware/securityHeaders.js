const helmet = require('helmet');

/**
 * Creates and configures production-grade security headers middleware (SEC-15).
 * Integrates Helmet with custom CSP, HSTS, X-Content-Type-Options, Referrer-Policy,
 * frame protection, and Permissions-Policy while preserving CORS and webhook compatibility.
 *
 * @param {object} [options]
 * @param {boolean} [options.isProd] - Whether production environment is active
 * @returns {Function} Express middleware function
 */
function createSecurityHeadersMiddleware(options = {}) {
  const isProd =
    options.isProd !== undefined ? options.isProd : process.env.NODE_ENV === 'production';

  // Base Helmet configuration
  const helmetMiddleware = helmet({
    // Content Security Policy tailored to LogicBridge frontend requirements
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // In development, allow eval/inline for Vite HMR
          ...(isProd ? ["'unsafe-inline'"] : ["'unsafe-inline'", "'unsafe-eval'"]),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          ...(isProd
            ? ['https:']
            : [
                'http://localhost:*',
                'ws://localhost:*',
                'http://127.0.0.1:*',
                'ws://127.0.0.1:*',
                'https:',
              ]),
        ],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },

    // HTTP Strict Transport Security (HSTS): Active in production only
    hsts: isProd
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,

    // X-Content-Type-Options: nosniff
    noSniff: true,

    // Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Frameguard (X-Frame-Options: DENY)
    frameguard: { action: 'deny' },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: { allow: false },

    // Cross-Origin Resource Policy
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // X-Download-Options (IE8+)
    ieNoOpen: true,

    // Disable X-Powered-By via Helmet
    hidePoweredBy: true,
  });

  return (req, res, next) => {
    // Unconditionally remove server-identifying header
    res.removeHeader('X-Powered-By');

    // Permissions-Policy header
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );

    // External inbound webhook routes are server-to-server payloads
    const isWebhook =
      req.path &&
      (req.path.startsWith('/api/webhooks/inbound') ||
        req.path.includes('/webhook') ||
        req.originalUrl?.includes('/webhook'));

    // Apply Helmet headers
    helmetMiddleware(req, res, () => {
      if (isWebhook) {
        // Strip CSP header for webhook endpoints so third-party senders are not constrained
        res.removeHeader('Content-Security-Policy');
      }
      next();
    });
  };
}

module.exports = createSecurityHeadersMiddleware;

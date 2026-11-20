require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const workflowRoutes = require('./routes/workflows');
const executionRoutes = require('./routes/executions');
const connectionRoutes = require('./routes/connections');
const oauthRoutes = require('./routes/oauth');
const scheduleRoutes = require('./routes/schedules');
const webhookRoutes = require('./routes/webhooks');
const healthRoutes = require('./routes/health');
const { initScheduler } = require('./services/scheduler');
const { mailProvider } = require('./providers');
const { recoverInterruptedExecutions } = require('./services/workflowEngine');
const { ensureWebhookIndexes, recoverAbandonedWebhookClaims } = require('./services/webhookService');
const { ensureExecutionIndexes } = require('./services/executionService');
const CredentialService = require('./services/CredentialService');
const createSecurityHeadersMiddleware = require('./middleware/securityHeaders');
const requestIdMiddleware = require('./middleware/requestId');
const lifecycleManager = require('./services/lifecycleManager');
const dataRetentionService = require('./services/dataRetentionService');

// Register process exception handlers early
lifecycleManager.setupProcessExceptionHandlers();

// Validate encryption key configuration immediately on startup
try {
  CredentialService.validateConfiguration();
} catch (configErr) {
  console.error(`❌ Security Startup Error: ${configErr.message}`);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
app.disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(createSecurityHeadersMiddleware());

// ── Secure CORS Configuration ───────────────────────────────────────────────
const PRODUCTION_ORIGIN = 'https://logicbridge-mp.vercel.app';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:8080',
];

function getAllowedOrigins() {
  const envVars = [
    process.env.ALLOWED_ORIGINS,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
  ];

  const envOrigins = envVars
    .filter(Boolean)
    .flatMap((val) => val.split(','))
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return new Set([
    PRODUCTION_ORIGIN,
    ...DEFAULT_DEV_ORIGINS,
    ...envOrigins,
  ]);
}

const allowedOriginsSet = getAllowedOrigins();

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();
  for (const allowed of allowedOriginsSet) {
    if (allowed.trim().replace(/\/+$/, '').toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header ? req.header('Origin') : req.headers?.origin;

  // External webhook routes are server-to-server and authenticated by HMAC/tokens,
  // so they are never blocked by browser CORS restrictions
  const isWebhookPath =
    req.path &&
    (req.path.startsWith('/api/webhooks/inbound') ||
      req.path.includes('/webhook') ||
      req.originalUrl?.includes('/webhook'));

  if (isWebhookPath) {
    return callback(null, { origin: true, credentials: true });
  }

  // Allow requests without Origin (e.g. mobile native, curl, Postman, server-side calls)
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  if (isOriginAllowed(origin)) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Idempotency-Key',
        'Idempotency-Key',
        'X-Correlation-Id',
        'X-Request-Id',
        'X-Hub-Signature-256',
        'X-Hub-Signature',
        'X-Timestamp',
        'X-Signature',
        'X-API-Key',
      ],
      exposedHeaders: ['X-Request-Id', 'Content-Range', 'X-Total-Count'],
      optionsSuccessStatus: 204,
      maxAge: 86400,
    });
  }

  // Reject unauthorized browser origin (omit Access-Control-Allow-Origin header)
  return callback(null, { origin: false });
};

// Middleware
app.use(cors(corsOptionsDelegate));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: '10mb',
  })
);

// Shutdown rejection middleware for keep-alive connections
app.use((req, res, next) => {
  if (lifecycleManager.isShuttingDown() && !req.path.startsWith('/api/health')) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server is undergoing graceful shutdown',
    });
  }
  next();
});

// Health check routes (Liveness, Readiness, and Backward-compatible Health)
app.use('/api/health', healthRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

const errorHandler = require('./middleware/errorHandler');

// Error handler
app.use(errorHandler);

// Connect DB + Start server
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logicbridge';

/**
 * Verify SMTP connectivity at startup. Non-blocking — server still starts
 * if SMTP is unavailable; EmailNode will surface errors at execution time.
 */
async function checkSmtpStatus() {
  if (!mailProvider.isConfigured()) {
    console.log('⚠  SMTP Disabled — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD to enable email delivery');
    return;
  }
  try {
    const result = await mailProvider.verifyConnection();
    if (result.ok) {
      console.log(`✓  SMTP Connected — ${result.message}`);
    } else {
      console.warn(`✗  SMTP Authentication Failed — ${result.message}`);
    }
  } catch {
    console.warn('✗  SMTP check encountered an unexpected error');
  }
}

/**
 * Validates and sanitizes MongoDB connection options with safe production fallbacks
 * @param {object} [env=process.env]
 * @returns {object}
 */
function getSanitizedMongoOptions(env = process.env) {
  const maxPool = parseInt(env.MONGO_MAX_POOL_SIZE, 10);
  const minPool = parseInt(env.MONGO_MIN_POOL_SIZE, 10);
  const socketTimeout = parseInt(env.MONGO_SOCKET_TIMEOUT_MS, 10);
  const serverSelectionTimeout = parseInt(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10);

  const safeMaxPool = Number.isInteger(maxPool) && maxPool > 0 ? maxPool : 50;
  const safeMinPool = Number.isInteger(minPool) && minPool >= 0 ? Math.min(minPool, safeMaxPool) : 5;
  const safeSocketTimeout = Number.isInteger(socketTimeout) && socketTimeout > 0 ? socketTimeout : 45000;
  const safeServerSelectionTimeout =
    Number.isInteger(serverSelectionTimeout) && serverSelectionTimeout > 0 ? serverSelectionTimeout : 10000;

  return {
    maxPoolSize: safeMaxPool,
    minPoolSize: safeMinPool,
    socketTimeoutMS: safeSocketTimeout,
    serverSelectionTimeoutMS: safeServerSelectionTimeout,
    autoIndex: env.NODE_ENV !== 'production',
  };
}

const mongoOptions = getSanitizedMongoOptions();

if (require.main === module) {
  mongoose
    .connect(MONGO_URI, mongoOptions)
    .then(async () => {
      console.log('✅ MongoDB connected');
      try {
        await ensureWebhookIndexes(); // safely reconcile historical duplicates & build unique indexes
      } catch (idxErr) {
        console.warn('⚠ Webhook index synchronization warning:', idxErr.message);
      }
      try {
        await ensureExecutionIndexes(); // safely reconcile obsolete resumeToken indexes to partial unique indexes
      } catch (execIdxErr) {
        console.warn('⚠ Execution index synchronization warning:', execIdxErr.message);
      }
      await recoverInterruptedExecutions(); // safely mark interrupted executions from server crashes
      try {
        await recoverAbandonedWebhookClaims(); // recover abandoned webhook processing claims
      } catch (whErr) {
        console.warn('⚠ Webhook claim recovery warning:', whErr.message);
      }
      const server = app.listen(PORT, () => console.log(`🚀 LogicBridge API running on http://localhost:${PORT}`));
      lifecycleManager.registerServer(server);
      lifecycleManager.registerSignalHandlers();
      await initScheduler(); // start all active scheduled workflows
      await checkSmtpStatus();
      dataRetentionService.startRetentionWorker(); // start periodic data lifecycle retention cleanup
    })
    .catch((err) => {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = { app, getSanitizedMongoOptions };

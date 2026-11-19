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
const { initScheduler } = require('./services/scheduler');
const { mailProvider } = require('./providers');
const { recoverInterruptedExecutions } = require('./services/workflowEngine');
const { ensureWebhookIndexes, recoverAbandonedWebhookClaims } = require('./services/webhookService');
const CredentialService = require('./services/CredentialService');
const createSecurityHeadersMiddleware = require('./middleware/securityHeaders');

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
app.use(createSecurityHeadersMiddleware());

// ── Secure CORS Configuration ───────────────────────────────────────────────
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function getAllowedOrigins() {
  const envOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    ''
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return new Set(envOrigins);
  }
  return new Set([...DEFAULT_DEV_ORIGINS, ...envOrigins]);
}

const allowedOriginsSet = getAllowedOrigins();

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');

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

  if (allowedOriginsSet.has(origin)) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Idempotency-Key',
        'Idempotency-Key',
        'X-Correlation-Id',
        'X-Hub-Signature-256',
        'X-Hub-Signature',
        'X-Timestamp',
        'X-Signature',
        'X-API-Key',
      ],
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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'LogicBridge API' }));

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

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await ensureWebhookIndexes(); // safely reconcile historical duplicates & build unique indexes
    } catch (idxErr) {
      console.warn('⚠ Webhook index synchronization warning:', idxErr.message);
    }
    await recoverInterruptedExecutions(); // safely mark interrupted executions from server crashes
    try {
      await recoverAbandonedWebhookClaims(); // recover abandoned webhook processing claims
    } catch (whErr) {
      console.warn('⚠ Webhook claim recovery warning:', whErr.message);
    }
    app.listen(PORT, () => console.log(`🚀 LogicBridge API running on http://localhost:${PORT}`));
    await initScheduler(); // start all active scheduled workflows
    await checkSmtpStatus();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

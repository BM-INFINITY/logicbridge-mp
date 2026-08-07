require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const workflowRoutes = require('./routes/workflows');
const executionRoutes = require('./routes/executions');
const connectionRoutes = require('./routes/connections');
const oauthRoutes = require('./routes/oauth');
const { initScheduler } = require('./services/scheduler');
const { mailProvider } = require('./providers');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'LogicBridge API' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/oauth', oauthRoutes);

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
    app.listen(PORT, () => console.log(`🚀 LogicBridge API running on http://localhost:${PORT}`));
    await initScheduler(); // start all active scheduled workflows
    await checkSmtpStatus();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

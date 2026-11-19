const mongoose = require('mongoose');

const RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 90;
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warn', 'error', 'critical'],
      default: 'info',
      index: true,
    },
    actorId: {
      type: String,
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      default: null,
    },
    actorRole: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    targetResource: {
      type: String,
      default: null,
      index: true,
    },
    correlationId: {
      type: String,
      default: null,
      index: true,
    },
    outcome: {
      type: String,
      enum: ['success', 'failure', 'blocked'],
      default: 'success',
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// TTL index to automatically purge audit records older than the retention period
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

// Compound indexes for administrative querying and investigation
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

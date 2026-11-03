const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
    endpointId: { type: String, default: '', index: true },
    correlationId: { type: String, default: '', index: true },
    eventIdentifier: { type: String, default: '', index: true }, // Idempotency key or event ID
    method: { type: String, default: 'POST', trim: true },
    url: { type: String, default: '' },

    // Masked headers and body (secrets/tokens stripped/redacted)
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Delivery & processing outcome
    status: {
      type: String,
      enum: ['success', 'failed', 'rejected', 'ignored', 'duplicate'],
      default: 'success',
      index: true,
    },
    httpStatus: { type: Number, default: 200 },
    execution: { type: mongoose.Schema.Types.ObjectId, ref: 'Execution', default: null },
    failureReason: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    ip: { type: String, default: '127.0.0.1' },
    duration: { type: Number, default: 0 }, // ms
    isReplay: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// High-performance compound indexes for history and deduplication lookups
webhookEventSchema.index({ workflow: 1, receivedAt: -1 });
webhookEventSchema.index({ workflow: 1, eventIdentifier: 1 });
webhookEventSchema.index({ workflow: 1, status: 1 });
webhookEventSchema.index({ correlationId: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);


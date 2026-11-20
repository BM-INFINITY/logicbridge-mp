const mongoose = require('mongoose');

const stepLogSchema = new mongoose.Schema({
  nodeId: String,
  nodeName: String,
  nodeType: String,
  status: {
    type: String,
    enum: ['success', 'failed', 'skipped', 'waiting', 'paused'],
    default: 'success',
  },
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  error: { type: String, default: null },
  duration: { type: Number, default: 0 }, // ms
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: null },
});

const checkpointSchema = new mongoose.Schema(
  {
    currentNodeId: { type: String, default: null },
    stepIndex: { type: Number, default: 0 },
    completedNodeIds: [{ type: String }],
    executedOutputs: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastOutput: { type: mongoose.Schema.Types.Mixed, default: null },
    variables: { type: mongoose.Schema.Types.Mixed, default: {} },
    skippedNodes: [{ type: String }],
    loopStack: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    approvalId: { type: String, default: null },
    nodeId: { type: String, default: null },
    title: { type: String, default: 'Approval Required' },
    message: { type: String, default: '' },
    allowedApprovers: [{ type: String }],
    approverRole: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'timeout', null],
      default: null,
    },
    decision: { type: String, enum: ['approved', 'rejected', null], default: null },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    comments: { type: String, default: null },
    timeoutMinutes: { type: Number, default: null },
    timeoutAt: { type: Date, default: null },
    timeoutAction: { type: String, enum: ['reject', 'approve', null], default: 'reject' },
    resumeToken: { type: String, default: null },
  },
  { _id: false }
);

const waitSchema = new mongoose.Schema(
  {
    waitId: { type: String, default: null },
    nodeId: { type: String, default: null },
    type: { type: String, enum: ['duration', 'date', 'event', null], default: null },
    durationSeconds: { type: Number, default: null },
    waitUntil: { type: Date, default: null },
    eventName: { type: String, default: null },
    resumeToken: { type: String, default: null },
    status: {
      type: String,
      enum: ['waiting', 'resumed', 'timeout', 'cancelled', null],
      default: null,
    },
    timeoutAt: { type: Date, default: null },
    resumedAt: { type: Date, default: null },
    resumedBy: { type: String, default: null },
    resumePayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const executionSchema = new mongoose.Schema(
  {
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['running', 'success', 'failed', 'paused', 'waiting_approval', 'expired', 'cancelled'],
      default: 'running',
    },
    trigger: { type: String, default: 'manual' }, // manual | schedule | webhook
    steps: [stepLogSchema],
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // total ms
    error: { type: String, default: null },
    checkpoint: { type: checkpointSchema, default: null },
    approval: { type: approvalSchema, default: null },
    wait: { type: waitSchema, default: null },
    occurrenceId: { type: String, default: null },
    resumeToken: { type: String, default: null },
    workerId: { type: String, default: null },
    heartbeatAt: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null },
    recovery: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret, options) => {
        if (!options?.includeResumeToken) {
          if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
          if (ret.approval && ret.approval.resumeToken) ret.approval.resumeToken = '[REDACTED]';
          if (ret.resumeToken) ret.resumeToken = '[REDACTED]';
          if (Array.isArray(ret.steps)) {
            ret.steps.forEach((s) => {
              if (s?.output && s.output.resumeToken) s.output.resumeToken = '[REDACTED]';
            });
          }
          if (ret.checkpoint?.lastOutput?.resumeToken) ret.checkpoint.lastOutput.resumeToken = '[REDACTED]';
          if (ret.checkpoint?.executedOutputs && typeof ret.checkpoint.executedOutputs === 'object') {
            for (const v of Object.values(ret.checkpoint.executedOutputs)) {
              if (v && typeof v === 'object' && v.resumeToken) v.resumeToken = '[REDACTED]';
            }
          }
        }
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret, options) => {
        if (!options?.includeResumeToken) {
          if (ret.wait && ret.wait.resumeToken) ret.wait.resumeToken = '[REDACTED]';
          if (ret.approval && ret.approval.resumeToken) ret.approval.resumeToken = '[REDACTED]';
          if (ret.resumeToken) ret.resumeToken = '[REDACTED]';
          if (Array.isArray(ret.steps)) {
            ret.steps.forEach((s) => {
              if (s?.output && s.output.resumeToken) s.output.resumeToken = '[REDACTED]';
            });
          }
          if (ret.checkpoint?.lastOutput?.resumeToken) ret.checkpoint.lastOutput.resumeToken = '[REDACTED]';
          if (ret.checkpoint?.executedOutputs && typeof ret.checkpoint.executedOutputs === 'object') {
            for (const v of Object.values(ret.checkpoint.executedOutputs)) {
              if (v && typeof v === 'object' && v.resumeToken) v.resumeToken = '[REDACTED]';
            }
          }
        }
        return ret;
      },
    },
  }
);

// Indexes for fast execution log queries and status filtering
executionSchema.index({ workflow: 1, startedAt: -1 });
executionSchema.index({ owner: 1, startedAt: -1 });
executionSchema.index({ status: 1 });
executionSchema.index({ 'approval.status': 1 });
// Partial unique index restricted strictly to valid string tokens (prevents duplicate null collisions)
executionSchema.index(
  { 'approval.resumeToken': 1 },
  {
    name: 'idx_approval_resume_token_unique',
    unique: true,
    partialFilterExpression: { 'approval.resumeToken': { $type: 'string' } },
  }
);
executionSchema.index({ 'wait.status': 1, 'wait.waitUntil': 1 });
executionSchema.index(
  { 'wait.resumeToken': 1 },
  {
    name: 'idx_wait_resume_token_unique',
    unique: true,
    partialFilterExpression: { 'wait.resumeToken': { $type: 'string' } },
  }
);
executionSchema.index(
  { occurrenceId: 1 },
  {
    name: 'idx_occurrence_id_unique',
    unique: true,
    partialFilterExpression: { occurrenceId: { $type: 'string' } },
  }
);
executionSchema.index({ status: 1, leaseExpiresAt: 1 });

module.exports = mongoose.model('Execution', executionSchema);

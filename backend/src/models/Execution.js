const mongoose = require('mongoose');

const stepLogSchema = new mongoose.Schema({
  nodeId: String,
  nodeName: String,
  nodeType: String,
  status: { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  error: { type: String, default: null },
  duration: { type: Number, default: 0 }, // ms
});

const executionSchema = new mongoose.Schema(
  {
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
    trigger: { type: String, default: 'manual' }, // manual | schedule | webhook
    steps: [stepLogSchema],
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // total ms
    error: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Execution', executionSchema);

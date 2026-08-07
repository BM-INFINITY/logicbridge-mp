const mongoose = require('mongoose');

const versionSnapshotSchema = new mongoose.Schema({
  version: Number,
  label: { type: String, default: '' },
  changeReason: { type: String, default: '' },
  name: String,
  description: String,
  nodes: Array,
  edges: Array,
  schedule: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: 'user' },
});

const workflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },
    version: { type: Number, default: 1 },
    versionHistory: [versionSnapshotSchema],
    nodes: { type: Array, default: [] },   // React Flow node array
    edges: { type: Array, default: [] },   // React Flow edge array
    schedule: {
      enabled: { type: Boolean, default: false },
      cron: { type: String, default: '' },  // cron expression e.g. "*/5 * * * *"
    },
    lastRunAt: { type: Date, default: null },
    runCount: { type: Number, default: 0 },
    aiGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for fast dashboard query resolution
workflowSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('Workflow', workflowSchema);

const mongoose = require('mongoose');

/**
 * WorkflowSecret — Model for encrypted workflow-scoped secrets.
 * Plaintext values are never stored at rest; values are encrypted with AES-256-GCM.
 * APIs and logs must never return the encryptedValue or decrypted plaintext.
 */
const workflowSecretSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    encryptedValue: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Enforce unique secret names per workflow
workflowSecretSchema.index({ workflowId: 1, name: 1 }, { unique: true });
workflowSecretSchema.index({ ownerId: 1, workflowId: 1 });

module.exports = mongoose.model('WorkflowSecret', workflowSecretSchema);


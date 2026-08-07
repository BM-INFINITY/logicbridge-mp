const mongoose = require('mongoose');

/**
 * Connection — stores a user's linked external account (Gmail, Outlook, SMTP, etc.)
 *
 * Credentials are always stored encrypted. The CredentialService handles
 * encrypt/decrypt — never expose raw credentials in queries or logs.
 */
const connectionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /** Provider identifier — must match a registered ConnectionProvider */
    provider: {
      type: String,
      required: true,
      enum: ['gmail', 'outlook', 'smtp'],
    },

    /** User-defined friendly name, e.g. "My Work Gmail" */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /** Connected account email displayed in the UI */
    email: {
      type: String,
      default: '',
      trim: true,
    },

    /** Connection health status */
    status: {
      type: String,
      enum: ['active', 'expired', 'disconnected', 'pending'],
      default: 'pending',
    },

    /**
     * Encrypted provider credentials blob.
     * Never query or log this field in plaintext.
     * Use CredentialService.decrypt() to access values.
     */
    credentials: {
      type: String,
      default: '',
      select: false, // excluded from queries by default — must be explicitly requested
    },

    /** Provider-specific metadata (non-sensitive) */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /** ISO timestamp of the last successful verification */
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

connectionSchema.index({ owner: 1, provider: 1 });

module.exports = mongoose.model('Connection', connectionSchema);

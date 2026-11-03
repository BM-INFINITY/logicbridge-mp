const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: 'Scheduled Trigger', trim: true },
    enabled: { type: Boolean, default: true, index: true },
    type: { type: String, enum: ['once', 'recurring'], default: 'recurring' },
    recurrence: { type: String, enum: ['daily', 'weekly', 'monthly', 'cron'], default: 'daily' },

    // One-time execution timestamp (ISO or Date)
    executionDate: { type: Date, default: null },

    // Daily, weekly, monthly time "HH:mm" (24-hour)
    time: { type: String, default: '09:00', trim: true },

    // Weekly: 0 = Sun, 1 = Mon, ..., 6 = Sat
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],

    // Monthly: day of month 1-31
    dayOfMonth: { type: Number, min: 1, max: 31, default: 1 },

    // Cron expression e.g. "0 9 * * 1-5" or "*/15 * * * *"
    cronExpression: { type: String, default: '', trim: true },

    // IANA Timezone string e.g. "UTC", "America/New_York", "Asia/Kolkata"
    timezone: { type: String, default: 'UTC', trim: true },

    // Schedule effective window
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Execution concurrency & downtime behavior
    preventOverlap: { type: Boolean, default: true },
    catchUpPolicy: { type: String, enum: ['skip', 'run_latest'], default: 'skip' },

    // Lifecycle status
    status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active', index: true },

    // Next scheduled run timestamp in UTC
    nextRunAt: { type: Date, default: null, index: true },
    lastRunAt: { type: Date, default: null },
    lastExecution: { type: mongoose.Schema.Types.ObjectId, ref: 'Execution', default: null },
    runCount: { type: Number, default: 0 },

    // Atomic worker distributed lock
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lockExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// High-performance compound indexes for schedule polling & listing
scheduleSchema.index({ enabled: 1, status: 1, nextRunAt: 1 });
scheduleSchema.index({ workflow: 1, createdAt: -1 });
scheduleSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Schedule', scheduleSchema);


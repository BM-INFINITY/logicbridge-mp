/**
 * Status values for workflow executions and steps
 */
const ExecutionStatus = Object.freeze({
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  PAUSED: 'paused',
  WAITING_APPROVAL: 'waiting_approval',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

module.exports = ExecutionStatus;

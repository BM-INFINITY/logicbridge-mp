/**
 * Status values for workflow executions and steps
 */
const ExecutionStatus = Object.freeze({
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

module.exports = ExecutionStatus;

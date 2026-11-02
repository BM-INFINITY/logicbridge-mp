class ExecutionPauseSignal extends Error {
  constructor(pauseType, details = {}) {
    super(`Workflow execution paused for ${pauseType}`);
    this.name = 'ExecutionPauseSignal';
    this.pauseType = pauseType; // 'approval' | 'wait'
    this.details = details;
  }
}

module.exports = ExecutionPauseSignal;


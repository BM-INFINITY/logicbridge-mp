/**
 * ExecutionContext encapsulates runtime state and metadata for workflow execution
 */
class ExecutionContext {
  /**
   * @param {object} options
   * @param {string} [options.workflowId]
   * @param {string} [options.executionId]
   * @param {string} [options.ownerId]
   * @param {string} [options.trigger]
   * @param {object} [options.initialResults]
   */
  constructor({ workflowId = null, executionId = null, ownerId = null, trigger = 'manual', initialResults = {} } = {}) {
    this.workflowId = workflowId;
    this.executionId = executionId;
    this.ownerId = ownerId;
    this.trigger = trigger;
    this.results = initialResults;
    this.lastOutput = null;
  }

  /**
   * Stores output for a node ID
   * @param {string} nodeId - Node ID key
   * @param {any} output - Execution output payload
   */
  setResult(nodeId, output) {
    this.results[nodeId] = output;
    this.lastOutput = output;
  }

  /**
   * Retrieves output for a specific node ID
   * @param {string} nodeId - Node ID key
   * @returns {any}
   */
  getResult(nodeId) {
    return this.results[nodeId];
  }

  /**
   * Returns previous step output
   * @returns {any}
   */
  getLastOutput() {
    return this.lastOutput;
  }
}

module.exports = ExecutionContext;

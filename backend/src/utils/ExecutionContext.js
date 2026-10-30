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
    this.loopStack = [];
  }

  /**
   * Pushes a new loop iteration scope onto the loop context stack
   * @param {object} loopState - { item, index, batch, batchIndex, total, isFirst, isLast, loopNodeId }
   */
  pushLoopContext(loopState) {
    this.loopStack.push(loopState);
    this.currentLoop = loopState;
  }

  /**
   * Pops the current loop iteration scope from the stack
   * @returns {object|null}
   */
  popLoopContext() {
    const popped = this.loopStack.pop() || null;
    this.currentLoop = this.loopStack.length > 0 ? this.loopStack[this.loopStack.length - 1] : null;
    return popped;
  }

  /**
   * Current active loop context scope
   * @returns {object|null}
   */
  get loopContext() {
    return this.currentLoop || (this.loopStack.length > 0 ? this.loopStack[this.loopStack.length - 1] : null);
  }

  /**
   * Updates or sets the current loop iteration scope
   * @param {object} loopState
   */
  setLoopContext(loopState) {
    this.currentLoop = loopState;
    if (this.loopStack.length > 0) {
      this.loopStack[this.loopStack.length - 1] = loopState;
    } else {
      this.loopStack.push(loopState);
    }
  }

  /**
   * Clears all loop context scopes
   */
  clearLoopContext() {
    this.loopStack = [];
    this.currentLoop = null;
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

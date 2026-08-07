/**
 * ExecutionPath tracks visited nodes, skipped nodes, and condition branch decisions
 */
class ExecutionPath {
  constructor() {
    this.visitedNodes = new Set();
    this.skippedNodes = new Set();
    this.branchHistory = [];
    this.events = [];
  }

  /**
   * Records a node as visited/executed
   * @param {string} nodeId
   */
  recordVisited(nodeId) {
    this.visitedNodes.add(nodeId);
  }

  /**
   * Records a node as skipped
   * @param {string} nodeId
   */
  recordSkipped(nodeId) {
    this.skippedNodes.add(nodeId);
  }

  /**
   * Records a condition branch evaluation decision
   * @param {string} conditionNodeId
   * @param {string} selectedBranch - 'true' or 'false'
   */
  recordBranch(conditionNodeId, selectedBranch) {
    this.branchHistory.push({
      conditionNodeId,
      selectedBranch,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emits an execution engine event
   * @param {string} type - Event type from ExecutionEvents
   * @param {object} payload
   */
  emitEvent(type, payload = {}) {
    this.events.push({
      type,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Returns a serializable summary of the execution path
   * @returns {object}
   */
  toJSON() {
    return {
      visitedNodes: Array.from(this.visitedNodes),
      skippedNodes: Array.from(this.skippedNodes),
      branchHistory: this.branchHistory,
      eventCount: this.events.length,
    };
  }
}

module.exports = ExecutionPath;

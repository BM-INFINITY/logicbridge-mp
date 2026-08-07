const { NodeTypes, BranchTypes } = require('../constants');

/**
 * Service handling branch evaluation and graph reachability calculations
 */
class BranchTraversal {
  /**
   * Returns active branch identifier based on condition result
   * @param {boolean} passed
   * @returns {string} - BranchTypes.TRUE ('true') or BranchTypes.FALSE ('false')
   */
  static getActiveBranch(passed) {
    return passed ? BranchTypes.TRUE : BranchTypes.FALSE;
  }

  /**
   * Returns skipped branch identifier based on condition result
   * @param {boolean} passed
   * @returns {string} - BranchTypes.FALSE ('false') or BranchTypes.TRUE ('true')
   */
  static getSkippedBranch(passed) {
    return passed ? BranchTypes.FALSE : BranchTypes.TRUE;
  }

  /**
   * Determines if a target node is reachable given executed condition node outputs
   * @param {object} node - Target node object
   * @param {Array} nodes - All workflow nodes
   * @param {Array} edges - All workflow edges
   * @param {Map|object} executedOutputs - Map of node outputs keyed by node.id
   * @param {Set} skippedNodeIds - Set of node IDs already determined to be skipped
   * @returns {boolean} - true if node should execute, false if it should be skipped
   */
  static isNodeExecutable(node, nodes, edges, executedOutputs, skippedNodeIds) {
    if (!edges || edges.length === 0) return true;

    const incomingEdges = edges.filter((e) => e.target === node.id);
    if (incomingEdges.length === 0) return true; // Start / trigger nodes are always executable

    // Check if at least one incoming edge originates from an active (non-skipped) path
    for (const edge of incomingEdges) {
      const sourceNodeId = edge.source;
      if (skippedNodeIds.has(sourceNodeId)) continue; // Skip paths from skipped nodes

      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) continue;

      if (sourceNode.type === NodeTypes.LOGIC_CONDITION) {
        const condOutput = executedOutputs[sourceNodeId];
        if (!condOutput) continue; // Source condition hasn't executed yet

        const activeBranch = this.getActiveBranch(Boolean(condOutput.passed));
        const edgeBranch = edge.sourceHandle || BranchTypes.TRUE; // Default edge fallback to TRUE

        if (edgeBranch === activeBranch) {
          return true; // Reached via selected condition branch!
        }
      } else {
        // Standard non-condition node path that succeeded
        return true;
      }
    }

    return false;
  }
}

module.exports = BranchTraversal;

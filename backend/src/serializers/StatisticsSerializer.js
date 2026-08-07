const { NodeTypes } = require('../constants');

/**
 * Serializer for workflow statistics calculation including depth and connectivity metrics
 */
class StatisticsSerializer {
  static serialize(nodes = [], edges = []) {
    let conditionCount = 0;
    let triggerCount = 0;
    let actionCount = 0;

    for (const n of nodes) {
      if (n.type === NodeTypes.LOGIC_CONDITION) conditionCount++;
      else if (String(n.type).startsWith('trigger-')) triggerCount++;
      else if (String(n.type).startsWith('action-')) actionCount++;
    }

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const averageConnections = nodeCount > 0 ? Number((edgeCount / nodeCount).toFixed(2)) : 0;

    // Calculate max depth and max branch depth via graph traversal
    const { maxDepth, maxBranchDepth } = this.calculateGraphDepths(nodes, edges);

    return {
      nodeCount,
      edgeCount,
      conditionCount,
      triggerCount,
      actionCount,
      maxDepth,
      maxBranchDepth,
      averageConnections,
    };
  }

  static calculateGraphDepths(nodes, edges) {
    if (!nodes || nodes.length === 0) return { maxDepth: 0, maxBranchDepth: 0 };

    const adjacency = {};
    const inDegree = {};
    nodes.forEach((n) => { adjacency[n.id] = []; inDegree[n.id] = 0; });

    edges.forEach((e) => {
      if (adjacency[e.source]) adjacency[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });

    const startNodes = nodes.filter((n) => inDegree[n.id] === 0);
    let overallMaxDepth = 0;
    let overallMaxBranchDepth = 0;

    function dfs(nodeId, currentDepth, currentBranchDepth, visited) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.find((n) => n.id === nodeId);
      const isCondition = node?.type === NodeTypes.LOGIC_CONDITION;

      const nextDepth = currentDepth + 1;
      const nextBranchDepth = currentBranchDepth + (isCondition ? 1 : 0);

      if (nextDepth > overallMaxDepth) overallMaxDepth = nextDepth;
      if (nextBranchDepth > overallMaxBranchDepth) overallMaxBranchDepth = nextBranchDepth;

      (adjacency[nodeId] || []).forEach((targetId) => {
        dfs(targetId, nextDepth, nextBranchDepth, new Set(visited));
      });
    }

    startNodes.forEach((n) => dfs(n.id, 0, 0, new Set()));

    return {
      maxDepth: overallMaxDepth > 0 ? overallMaxDepth : nodes.length > 0 ? 1 : 0,
      maxBranchDepth: overallMaxBranchDepth,
    };
  }

  static deserialize(stats = {}) {
    return {
      nodeCount: stats.nodeCount ?? 0,
      edgeCount: stats.edgeCount ?? 0,
      conditionCount: stats.conditionCount ?? 0,
      triggerCount: stats.triggerCount ?? 0,
      actionCount: stats.actionCount ?? 0,
      maxDepth: stats.maxDepth ?? 0,
      maxBranchDepth: stats.maxBranchDepth ?? 0,
      averageConnections: stats.averageConnections ?? 0,
    };
  }

  static validate(stats = {}) {
    if (typeof stats !== 'object' || stats === null) return { valid: false, error: 'Statistics must be an object' };
    return { valid: true };
  }
}

module.exports = StatisticsSerializer;

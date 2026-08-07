/**
 * WorkflowDiffService compares two workflow states and computes diff metrics
 */
class WorkflowDiffService {
  /**
   * Compares versionA and versionB workflow objects or snapshots
   * @param {object} versionA - Base workflow object
   * @param {object} versionB - Target workflow object
   * @returns {object} - Diff report payload
   */
  static diff(versionA = {}, versionB = {}) {
    const nodesA = versionA.nodes || [];
    const nodesB = versionB.nodes || [];
    const edgesA = versionA.edges || [];
    const edgesB = versionB.edges || [];

    const mapA = new Map(nodesA.map((n) => [n.id, n]));
    const mapB = new Map(nodesB.map((n) => [n.id, n]));

    const addedNodes = nodesB.filter((n) => !mapA.has(n.id));
    const removedNodes = nodesA.filter((n) => !mapB.has(n.id));
    const modifiedNodes = [];

    for (const [id, nodeB] of mapB.entries()) {
      const nodeA = mapA.get(id);
      if (nodeA) {
        const dataChanged = JSON.stringify(nodeA.data || {}) !== JSON.stringify(nodeB.data || {});
        const typeChanged = nodeA.type !== nodeB.type;

        if (dataChanged || typeChanged) {
          modifiedNodes.push({
            id,
            type: nodeB.type,
            dataChanged,
            typeChanged,
            oldType: nodeA.type,
            newType: nodeB.type,
          });
        }
      }
    }

    const edgeSetA = new Set(edgesA.map((e) => `${e.source}->${e.target}:${e.sourceHandle || ''}`));
    const edgeSetB = new Set(edgesB.map((e) => `${e.source}->${e.target}:${e.sourceHandle || ''}`));

    const addedEdges = edgesB.filter((e) => !edgeSetA.has(`${e.source}->${e.target}:${e.sourceHandle || ''}`));
    const removedEdges = edgesA.filter((e) => !edgeSetB.has(`${e.source}->${e.target}:${e.sourceHandle || ''}`));

    const configurationChanges = [];
    if ((versionA.name || '') !== (versionB.name || '')) {
      configurationChanges.push({ field: 'name', from: versionA.name, to: versionB.name });
    }
    if ((versionA.description || '') !== (versionB.description || '')) {
      configurationChanges.push({ field: 'description', from: versionA.description, to: versionB.description });
    }
    if (JSON.stringify(versionA.schedule || {}) !== JSON.stringify(versionB.schedule || {})) {
      configurationChanges.push({ field: 'schedule', from: versionA.schedule, to: versionB.schedule });
    }

    return {
      addedNodes: addedNodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
      removedNodes: removedNodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
      modifiedNodes,
      addedEdgesCount: addedEdges.length,
      removedEdgesCount: removedEdges.length,
      configurationChanges,
      hasChanges:
        addedNodes.length > 0 ||
        removedNodes.length > 0 ||
        modifiedNodes.length > 0 ||
        addedEdges.length > 0 ||
        removedEdges.length > 0 ||
        configurationChanges.length > 0,
    };
  }
}

module.exports = WorkflowDiffService;

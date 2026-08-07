/**
 * Serializer for workflow React Flow edge connections
 */
class EdgeSerializer {
  static serialize(edges = []) {
    return edges.map((edge) => ({
      id: String(edge.id || `edge_${edge.source}_${edge.target}`),
      source: String(edge.source),
      target: String(edge.target),
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      branch: edge.branch || edge.data?.branch || (edge.sourceHandle === 'true' ? 'true' : edge.sourceHandle === 'false' ? 'false' : 'default'),
      label: edge.label || null,
      animated: edge.animated ?? true,
      style: edge.style || null,
    }));
  }

  static deserialize(edges = []) {
    return this.serialize(edges);
  }

  static validate(edges = [], nodes = []) {
    if (!Array.isArray(edges)) return { valid: false, error: 'Edges must be an array' };
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const edge of edges) {
      if (!edge.source) return { valid: false, error: 'Edge missing required "source"' };
      if (!edge.target) return { valid: false, error: 'Edge missing required "target"' };
      if (nodeIds.size > 0) {
        if (!nodeIds.has(edge.source)) return { valid: false, error: `Edge source "${edge.source}" does not exist in nodes` };
        if (!nodeIds.has(edge.target)) return { valid: false, error: `Edge target "${edge.target}" does not exist in nodes` };
      }
    }
    return { valid: true };
  }
}

module.exports = EdgeSerializer;

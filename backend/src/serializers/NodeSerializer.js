/**
 * Serializer for workflow React Flow node graphs
 */
class NodeSerializer {
  static serialize(nodes = []) {
    return nodes.map((node) => ({
      id: String(node.id),
      type: String(node.type),
      position: node.position || { x: 0, y: 0 },
      data: { ...(node.data || {}) },
    }));
  }

  static deserialize(nodes = []) {
    return this.serialize(nodes);
  }

  static validate(nodes = []) {
    if (!Array.isArray(nodes)) return { valid: false, error: 'Nodes must be an array' };
    const ids = new Set();
    for (const node of nodes) {
      if (!node.id) return { valid: false, error: 'Node missing required "id"' };
      if (!node.type) return { valid: false, error: `Node "${node.id}" missing required "type"` };
      if (ids.has(node.id)) return { valid: false, error: `Duplicate node ID detected: "${node.id}"` };
      ids.add(node.id);
    }
    return { valid: true };
  }
}

module.exports = NodeSerializer;

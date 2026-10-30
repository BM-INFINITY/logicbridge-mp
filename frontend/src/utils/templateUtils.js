/**
 * templateUtils.js — Utilities for instantiating and handling workflow templates.
 */

let instantiationCounter = 0;

/**
 * Deep clones an object and rewrites mustache variable expressions
 * that reference old node IDs to point to newly generated node IDs.
 *
 * e.g. {{ n2.userId }} -> {{ node_1700000000_1_2.userId }}
 *      {{ steps.n2.id }} -> {{ steps.node_1700000000_1_2.id }}
 *      {{ n2 }} -> {{ node_1700000000_1_2 }}
 *
 * @param {any} val - Value to rewrite
 * @param {Record<string, string>} idMap - Mapping from old node ID to new node ID
 * @returns {any} Rewritten deep clone
 */
function rewriteNodeIdRefs(val, idMap) {
  if (typeof val === 'string') {
    let result = val;
    // Sort keys by length descending so longer IDs (e.g. n10) are replaced before shorter prefixes (e.g. n1)
    const sorted = Object.entries(idMap).sort((a, b) => b[0].length - a[0].length);
    for (const [oldId, newId] of sorted) {
      const regex = new RegExp('(\\{\\{\\s*(?:steps\\.)?)' + oldId + '(\\.[^}]*|\\s*\\}\\})', 'g');
      result = result.replace(regex, (_match, prefix, suffix) => {
        return prefix + newId + suffix;
      });
    }
    return result;
  }

  if (Array.isArray(val)) {
    return val.map((item) => rewriteNodeIdRefs(item, idMap));
  }

  if (val !== null && typeof val === 'object') {
    const cloned = {};
    for (const [key, propVal] of Object.entries(val)) {
      cloned[key] = rewriteNodeIdRefs(propVal, idMap);
    }
    return cloned;
  }

  return val;
}

/**
 * Instantiates a template into a fresh, isolated workflow structure
 * with guaranteed unique node and edge IDs, while preserving all
 * node configurations, coordinates, handles, branches, and styling.
 *
 * @param {object} template - The template definition from TEMPLATES
 * @returns {{ name: string, description: string, nodes: Array, edges: Array }}
 */
export function instantiateTemplate(template) {
  if (!template) {
    return { name: 'Untitled Workflow', description: '', nodes: [], edges: [] };
  }

  instantiationCounter = (instantiationCounter + 1) % 1_000_000;
  const timestamp = `${Date.now()}_${instantiationCounter}`;
  const idMap = {};

  // 1. Generate unique node IDs and clone data
  const rawNodes = template.nodes || [];
  const instantiatedNodes = rawNodes.map((node, idx) => {
    const uniqueId = `node_${timestamp}_${idx + 1}`;
    idMap[node.id] = uniqueId;

    return {
      ...node,
      id: uniqueId,
      position: node.position ? { ...node.position } : { x: 100, y: 100 },
      data: JSON.parse(JSON.stringify(node.data || {})),
    };
  });

  // 2. Rewrite mustache references that referenced old node IDs
  const nodes = instantiatedNodes.map((node) => ({
    ...node,
    data: rewriteNodeIdRefs(node.data, idMap),
  }));

  // 3. Generate unique edge IDs and remap source/target to new node IDs
  const rawEdges = template.edges || [];
  const edges = rawEdges.map((edge, idx) => {
    const newSource = idMap[edge.source] || edge.source;
    const newTarget = idMap[edge.target] || edge.target;
    const uniqueEdgeId = `edge_${timestamp}_${idx + 1}`;

    return {
      ...edge,
      id: uniqueEdgeId,
      source: newSource,
      target: newTarget,
      data: edge.data ? JSON.parse(JSON.stringify(edge.data)) : undefined,
      style: edge.style ? { ...edge.style } : undefined,
      labelStyle: edge.labelStyle ? { ...edge.labelStyle } : undefined,
    };
  });

  return {
    name: template.name || 'Untitled Workflow',
    description: template.description || '',
    nodes,
    edges,
  };
}

export default instantiateTemplate;


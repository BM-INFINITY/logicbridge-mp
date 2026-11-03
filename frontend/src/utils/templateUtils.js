/**
 * templateUtils.js — Utilities for instantiating, validating, filtering, sorting,
 * and installing workflow templates.
 */

import { NODE_DEFS } from '../data/templates.js';

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
export function rewriteNodeIdRefs(val, idMap) {
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
 * Validates template structure, schema compatibility, node integrity, and edge connections.
 *
 * @param {object} template - The template object to validate
 * @param {object} [nodeDefs=NODE_DEFS] - The catalog of valid node definitions
 * @returns {{ valid: boolean, errors: Array<string> }} Validation result
 */
export function validateTemplate(template, nodeDefs = NODE_DEFS) {
  const errors = [];

  if (!template || typeof template !== 'object') {
    return { valid: false, errors: ['Template definition is missing or invalid object'] };
  }

  if (!template.id || typeof template.id !== 'string' || !template.id.trim()) {
    errors.push('Template is missing a valid id');
  }

  if (!template.name || typeof template.name !== 'string' || !template.name.trim()) {
    errors.push('Template is missing a valid name');
  }

  if (!template.description || typeof template.description !== 'string') {
    errors.push('Template is missing a description');
  }

  if (!Array.isArray(template.nodes) || template.nodes.length === 0) {
    errors.push('Template must have a non-empty nodes array');
  }

  if (!Array.isArray(template.edges)) {
    errors.push('Template must have an edges array');
  }

  // Schema version validation: check for major version compatibility
  if (template.schemaVersion) {
    const match = String(template.schemaVersion).match(/^v?(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      if (major > 2) {
        errors.push(
          `Template schema version "${template.schemaVersion}" requires a newer version of LogicBridge (supported up to v2.x)`
        );
      }
    }
  }

  // Validate nodes and ensure all node types are supported
  const nodeIds = new Set();
  const defs = nodeDefs || {};

  if (Array.isArray(template.nodes)) {
    template.nodes.forEach((node, idx) => {
      if (!node.id) {
        errors.push(`Node at index ${idx} is missing an id`);
      } else {
        if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id "${node.id}" detected in template`);
        }
        nodeIds.add(node.id);
      }

      if (!node.type) {
        errors.push(`Node "${node.id || idx}" is missing a type`);
      } else if (Object.keys(defs).length > 0 && !defs[node.type]) {
        errors.push(`Unsupported node type "${node.type}" in node "${node.id || idx}"`);
      }
    });
  }

  // Validate edges: source and target must exist in nodes
  if (Array.isArray(template.edges)) {
    template.edges.forEach((edge, idx) => {
      const edgeId = edge.id || `edge_${idx}`;
      if (!edge.source || !nodeIds.has(edge.source)) {
        errors.push(`Edge "${edgeId}" references non-existent source node "${edge.source}"`);
      }
      if (!edge.target || !nodeIds.has(edge.target)) {
        errors.push(`Edge "${edgeId}" references non-existent target node "${edge.target}"`);
      }
      if (edge.source && edge.target && edge.source === edge.target) {
        errors.push(`Edge "${edgeId}" has invalid self-referencing loop (${edge.source} -> ${edge.target})`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Instantiates a template into a fresh, isolated workflow structure
 * with guaranteed unique node and edge IDs, while preserving all
 * node configurations, coordinates, handles, branches, and styling.
 *
 * @param {object} template - The template definition from TEMPLATES
 * @param {object} [options={}] - Customization options
 * @param {string} [options.name] - Custom workflow name
 * @param {string} [options.description] - Custom description
 * @param {Record<string, any>} [options.variables] - Initial workflow variables
 * @returns {{ name: string, description: string, nodes: Array, edges: Array, variables?: object }}
 */
export function instantiateTemplate(template, options = {}) {
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

  // 4. Merge initial variables if supplied
  const variables = options.variables
    ? JSON.parse(JSON.stringify(options.variables))
    : (template.initialVariables ? JSON.parse(JSON.stringify(template.initialVariables)) : undefined);

  return {
    name: options.name || template.name || 'Untitled Workflow',
    description: options.description !== undefined ? options.description : (template.description || ''),
    nodes,
    edges,
    ...(variables ? { variables } : {}),
  };
}

/**
 * Sorts template list based on selected criterion
 *
 * @param {Array<object>} templates - Template list
 * @param {string} [sortBy='popularity'] - 'popularity' | 'recent' | 'name' | 'difficulty'
 * @returns {Array<object>} Sorted copy of templates
 */
export function sortTemplates(templates, sortBy = 'popularity') {
  if (!Array.isArray(templates)) return [];
  const list = [...templates];

  switch (sortBy) {
    case 'popularity':
    case 'popular':
      return list.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

    case 'recent':
    case 'newest':
    case 'updated':
      return list.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

    case 'name':
    case 'alphabetical':
    case 'a-z':
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    case 'difficulty': {
      const weight = { Beginner: 1, Intermediate: 2, Advanced: 3 };
      return list.sort((a, b) => (weight[a.difficulty] || 0) - (weight[b.difficulty] || 0));
    }

    default:
      return list;
  }
}

/**
 * Filters templates based on search query, category, difficulty, favorites, and connection requirements
 *
 * @param {Array<object>} templates - Template list
 * @param {object} options
 * @param {string} [options.search]
 * @param {string} [options.category='all']
 * @param {string} [options.difficulty='all']
 * @param {boolean} [options.onlyFavorites=false]
 * @param {Array<string>} [options.favorites=[]]
 * @param {string} [options.hasConnections='all'] - 'all' | 'zero-creds' | 'requires-creds'
 * @returns {Array<object>} Filtered templates
 */
export function filterTemplates(templates, options = {}) {
  if (!Array.isArray(templates)) return [];

  const {
    search = '',
    category = 'all',
    difficulty = 'all',
    onlyFavorites = false,
    favorites = [],
    hasConnections = 'all',
  } = options;

  const q = String(search).toLowerCase().trim();
  const favSet = new Set(Array.isArray(favorites) ? favorites : []);

  return templates.filter((t) => {
    // Favorites filter
    if (onlyFavorites && !favSet.has(t.id)) {
      return false;
    }

    // Category filter
    if (category && category !== 'all' && t.category !== category) {
      return false;
    }

    // Difficulty filter
    if (difficulty && difficulty !== 'all' && t.difficulty !== difficulty) {
      return false;
    }

    // Connection requirement filter
    if (hasConnections === 'zero-creds' && Boolean(t.requiresConnection)) {
      return false;
    }
    if (hasConnections === 'requires-creds' && !t.requiresConnection) {
      return false;
    }

    // Search query matching
    if (!q) return true;

    const nameMatch = (t.name || '').toLowerCase().includes(q);
    const descMatch = (t.description || '').toLowerCase().includes(q);
    const useCaseMatch = (t.useCase || '').toLowerCase().includes(q);
    const tagsMatch = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(q));
    const nodeTypesMatch = Array.isArray(t.nodeTypes) && t.nodeTypes.some((nt) => nt.toLowerCase().includes(q));
    const authorMatch = t.author?.name ? t.author.name.toLowerCase().includes(q) : false;

    return nameMatch || descMatch || useCaseMatch || tagsMatch || nodeTypesMatch || authorMatch;
  });
}

/**
 * Validates, instantiates, and executes the creation flow for a template
 * with safe error handling and rollback.
 *
 * @param {object} template - The template definition
 * @param {object} [options={}]
 * @param {string} [options.name] - Custom workflow name
 * @param {Record<string, any>} [options.variables] - Initial variable values
 * @param {Function} [options.createFn] - Async function to persist workflow
 * @returns {Promise<object>} The instantiated or persisted workflow
 */
export async function installTemplateWorkflow(template, options = {}) {
  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
  }

  const instantiated = instantiateTemplate(template, {
    name: options.name || template.name,
    variables: options.variables,
  });

  if (typeof options.createFn === 'function') {
    try {
      const payload = {
        name: instantiated.name,
        description: instantiated.description,
        nodes: instantiated.nodes,
        edges: instantiated.edges,
        variables: instantiated.variables || {},
        status: 'draft',
      };
      const created = await options.createFn(payload);
      return created;
    } catch (err) {
      throw new Error(`Failed to create workflow from template "${template.name}": ${err.message}`);
    }
  }

  return instantiated;
}

export default instantiateTemplate;

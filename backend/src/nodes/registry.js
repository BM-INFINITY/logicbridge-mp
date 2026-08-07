const { ConfigurationError } = require('../errors');

/**
 * Node Registry Manager for LogicBridge Workflow Nodes
 */
class NodeRegistry {
  constructor() {
    this.nodes = new Map();
  }

  /**
   * Registers a node handler instance after validating required metadata
   * @param {object} nodeInstance - Instance of BaseNode subclass
   */
  register(nodeInstance) {
    if (!nodeInstance) {
      throw new ConfigurationError('Cannot register null or undefined node handler instance');
    }

    const meta = typeof nodeInstance.metadata === 'function' ? nodeInstance.metadata() : nodeInstance;
    const requiredFields = ['type', 'name', 'category', 'version'];

    for (const field of requiredFields) {
      if (!meta[field]) {
        throw new ConfigurationError(
          `Node registration failed for "${nodeInstance.constructor?.name || 'UnknownNode'}": Missing required metadata field "${field}"`
        );
      }
    }

    this.nodes.set(meta.type, nodeInstance);
  }

  /**
   * Returns a registered node handler instance by type identifier
   * @param {string} type - Node type string (e.g. 'action-http')
   * @returns {object|undefined}
   */
  get(type) {
    return this.nodes.get(type);
  }

  /**
   * Returns all registered node handler instances
   * @returns {Array<object>}
   */
  getAll() {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns registered node handlers matching a specific category
   * @param {string} category - Category string ('trigger', 'action', 'logic')
   * @returns {Array<object>}
   */
  getByCategory(category) {
    return this.getAll().filter(n => (n.category || n.metadata?.().category) === category);
  }

  /**
   * Checks if a node type is registered
   * @param {string} type - Node type string
   * @returns {boolean}
   */
  has(type) {
    return this.nodes.has(type);
  }

  /**
   * Helper method to execute a node by type identifier
   * @param {string} type - Node type identifier
   * @param {object} node - React Flow node object
   * @param {object} context - ExecutionContext instance or context object
   * @returns {Promise<object>}
   */
  async execute(type, node, context) {
    const handler = this.get(type);
    if (!handler) {
      throw new Error(`No registered node handler for type: "${type}"`);
    }

    if (typeof handler.validate === 'function') {
      const validation = handler.validate(node);
      if (validation && validation.valid === false) {
        throw new Error(validation.error || `Validation failed for node "${node.data?.label || type}"`);
      }
    }

    return handler.execute(node, context);
  }

  /**
   * Returns metadata list for all registered nodes
   * @returns {Array<object>}
   */
  metadata() {
    return this.getAll().map(n => typeof n.metadata === 'function' ? n.metadata() : n);
  }

  /**
   * Alias for metadata()
   * @returns {Array<object>}
   */
  listMetadata() {
    return this.metadata();
  }
}

// Singleton Instance
const registry = new NodeRegistry();

module.exports = registry;

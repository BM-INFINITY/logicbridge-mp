/**
 * Abstract Base Node Class for all LogicBridge workflow node types
 */
class BaseNode {
  /**
   * @param {object} meta
   * @param {string} meta.type - Unique type key (e.g. 'action-http')
   * @param {string} meta.name - Human-readable name
   * @param {string} meta.category - Node category ('trigger', 'action', 'logic')
   * @param {string} [meta.icon] - Visual icon emoji or string
   * @param {string} [meta.description] - Description of node functionality
   * @param {string} [meta.version] - Version string (default '1.0.0')
   */
  constructor({ type, name = '', category = 'action', icon = '⚙️', description = '', version = '1.0.0' }) {
    if (typeof type === 'string' && !name) name = type;
    this.type = type;
    this.name = name;
    this.category = category;
    this.icon = icon;
    this.description = description;
    this.version = version;
  }

  /**
   * Executes node action logic
   * @param {object} node - React Flow node instance
   * @param {object} context - Execution context { results, lastOutput }
   * @returns {Promise<object>}
   */
  async execute(node, context) {
    throw new Error(`execute() must be implemented for node type "${this.type}"`);
  }

  /**
   * Validates node data before execution
   * @param {object} node - React Flow node instance
   * @returns {object} - { valid: boolean, error?: string }
   */
  validate(node) {
    return { valid: true };
  }

  /**
   * Returns complete node metadata
   * @returns {object}
   */
  metadata() {
    return {
      type: this.type,
      name: this.name,
      category: this.category,
      icon: this.icon,
      description: this.description,
      version: this.version,
    };
  }
}

module.exports = BaseNode;

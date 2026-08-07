const { NodeTypes } = require('../constants');

/**
 * TriggerRegistry manages trigger handlers consistent with NodeRegistry
 */
class TriggerRegistry {
  constructor() {
    this.triggers = new Map();
  }

  /**
   * Registers a trigger handler instance
   * @param {object} triggerInstance
   */
  register(triggerInstance) {
    if (!triggerInstance) return;
    const meta = typeof triggerInstance.metadata === 'function' ? triggerInstance.metadata() : triggerInstance;
    if (meta?.type) {
      this.triggers.set(meta.type, triggerInstance);
    }
  }

  /**
   * Retrieves a trigger handler by type identifier
   * @param {string} type
   * @returns {object|undefined}
   */
  get(type) {
    return this.triggers.get(type);
  }

  /**
   * Returns all registered trigger instances
   * @returns {Array<object>}
   */
  getAll() {
    return Array.from(this.triggers.values());
  }

  /**
   * Checks if type is a trigger node
   * @param {string} type
   * @returns {boolean}
   */
  isTrigger(type) {
    return (
      type === NodeTypes.TRIGGER_MANUAL ||
      type === NodeTypes.TRIGGER_SCHEDULE ||
      type === NodeTypes.TRIGGER_WEBHOOK ||
      this.triggers.has(type)
    );
  }
}

const triggerRegistry = new TriggerRegistry();

module.exports = triggerRegistry;

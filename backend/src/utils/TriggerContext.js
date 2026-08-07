/**
 * TriggerContext standardizes execution input across all trigger types
 */
class TriggerContext {
  /**
   * @param {object} options
   * @param {string} options.triggerType - 'manual' | 'schedule' | 'webhook'
   * @param {any} [options.payload]
   * @param {object} [options.headers]
   * @param {object} [options.query]
   */
  constructor({ triggerType = 'manual', payload = null, headers = {}, query = {} } = {}) {
    this.triggerType = triggerType;
    this.payload = payload;
    this.headers = headers;
    this.query = query;
    this.receivedAt = new Date().toISOString();
  }
}

module.exports = TriggerContext;

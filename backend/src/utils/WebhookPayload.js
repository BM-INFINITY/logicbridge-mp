/**
 * WebhookPayload encapsulates incoming HTTP webhook request parameters
 */
class WebhookPayload {
  /**
   * Constructs WebhookPayload from Express request
   * @param {object} req - Express request object
   * @returns {WebhookPayload}
   */
  static fromRequest(req) {
    return new WebhookPayload({
      body: req.body || {},
      headers: req.headers || {},
      query: req.query || {},
      params: req.params || {},
      method: req.method || 'POST',
      ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    });
  }

  constructor({ body = {}, headers = {}, query = {}, params = {}, method = 'POST', ip = '127.0.0.1' } = {}) {
    this.body = body;
    this.headers = headers;
    this.query = query;
    this.params = params;
    this.method = method;
    this.ip = ip;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = WebhookPayload;

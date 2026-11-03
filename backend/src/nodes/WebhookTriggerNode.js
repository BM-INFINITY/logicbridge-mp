const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class WebhookTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_WEBHOOK,
      name: 'Webhook Trigger',
      category: 'trigger',
      icon: 'Webhook',
      description: 'Triggers workflow execution via incoming HTTP webhooks with authentication, HMAC validation, and deduplication',
      version: '1.1.0',
    });
  }

  /**
   * Validates webhook trigger configuration
   * @param {object} node
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(node) {
    const data = node.data || {};
    const authType = String(data.authType || 'none').toLowerCase().trim();

    if (!['none', 'bearer', 'apikey', 'api_key', 'hmac'].includes(authType)) {
      return { valid: false, error: 'Auth type must be one of: none, bearer, apiKey, hmac' };
    }

    if (authType === 'bearer' && (!data.authToken || !String(data.authToken).trim())) {
      return { valid: false, error: 'Bearer token is required when Bearer Auth is selected' };
    }

    if ((authType === 'apikey' || authType === 'api_key') && (!data.apiKeyValue || !String(data.apiKeyValue).trim())) {
      return { valid: false, error: 'API Key value is required when API Key Auth is selected' };
    }

    if (authType === 'hmac') {
      if (!data.hmacSecret || !String(data.hmacSecret).trim()) {
        return { valid: false, error: 'HMAC secret is required when HMAC Signature is selected' };
      }
      const algo = String(data.hmacAlgorithm || 'sha256').toLowerCase().trim();
      if (!['sha256', 'sha512', 'sha1', 'md5'].includes(algo)) {
        return { valid: false, error: `Invalid HMAC algorithm "${algo}". Supported: sha256, sha512, sha1` };
      }
    }

    if (data.responseStatus !== undefined && data.responseStatus !== null && data.responseStatus !== '') {
      const status = parseInt(data.responseStatus, 10);
      if (isNaN(status) || status < 100 || status > 599) {
        return { valid: false, error: 'Response status code must be a valid HTTP status between 100 and 599' };
      }
    }

    return { valid: true };
  }

  async execute(node, context) {
    const triggerData = context.triggerPayload || context.lastOutput || {};

    return {
      triggered: true,
      triggerType: 'webhook',
      endpointId: node.data?.endpointId || '',
      correlationId: triggerData.correlationId || '',
      eventIdentifier: triggerData.eventIdentifier || '',
      isReplay: Boolean(triggerData.isReplay),
      body: triggerData.body || triggerData,
      headers: triggerData.headers || {},
      query: triggerData.query || {},
      params: triggerData.params || {},
      method: triggerData.method || 'POST',
      ip: triggerData.ip || '127.0.0.1',
      receivedAt: triggerData.timestamp || new Date().toISOString(),
    };
  }
}

module.exports = WebhookTriggerNode;

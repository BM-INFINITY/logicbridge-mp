const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class WebhookTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_WEBHOOK,
      name: 'Webhook Trigger',
      category: 'trigger',
      icon: '🔗',
      description: 'Triggers workflow execution via incoming HTTP POST/GET webhooks',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const triggerData = context.triggerPayload || context.lastOutput || {};

    return {
      triggered: true,
      triggerType: 'webhook',
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

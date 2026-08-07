const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class WebhookTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_WEBHOOK,
      name: 'Webhook Trigger',
      category: 'trigger',
      icon: '🔗',
      description: 'Triggers workflow upon receiving an HTTP webhook payload',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    return {
      triggered: true,
      payload: context.lastOutput || {},
      triggeredAt: new Date().toISOString(),
    };
  }
}

module.exports = WebhookTriggerNode;

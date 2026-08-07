const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class ManualTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_MANUAL,
      name: 'Manual Trigger',
      category: 'trigger',
      icon: '⚡',
      description: 'Triggers workflow manually via UI button click',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    return {
      triggered: true,
      triggeredAt: new Date().toISOString(),
      message: 'Workflow started manually',
    };
  }
}

module.exports = ManualTriggerNode;

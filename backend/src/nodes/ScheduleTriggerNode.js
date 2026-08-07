const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class ScheduleTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_SCHEDULE,
      name: 'Schedule Trigger',
      category: 'trigger',
      icon: '🕐',
      description: 'Triggers workflow automatically on a cron schedule',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    return {
      triggered: true,
      schedule: node.data?.cron || '',
      triggeredAt: new Date().toISOString(),
    };
  }
}

module.exports = ScheduleTriggerNode;

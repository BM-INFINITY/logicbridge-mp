const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class ScheduleTriggerNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.TRIGGER_SCHEDULE,
      name: 'Schedule Trigger',
      category: 'trigger',
      icon: 'Clock',
      description: 'Triggers workflow automatically on a scheduled or recurring basis',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const payload = context.triggerPayload || {};
    return {
      triggered: true,
      scheduleId: payload.scheduleId || '',
      scheduleName: payload.scheduleName || '',
      schedule: node.data?.cron || payload.cron || payload.cronExpression || '',
      timezone: payload.timezone || 'UTC',
      recurrence: payload.recurrence || 'cron',
      scheduledTime: payload.scheduledTime || new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
    };
  }
}

module.exports = ScheduleTriggerNode;

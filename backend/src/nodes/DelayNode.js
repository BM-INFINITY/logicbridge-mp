const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');

class DelayNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_DELAY,
      name: 'Delay',
      category: 'action',
      icon: '⏱️',
      description: 'Pauses workflow execution for a configured duration in seconds',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const ms = (node.data?.seconds || 1) * 1000;
    await new Promise((res) => setTimeout(res, ms));
    return { delayed: ms, seconds: node.data?.seconds || 1, completedAt: new Date().toISOString() };
  }
}

module.exports = DelayNode;

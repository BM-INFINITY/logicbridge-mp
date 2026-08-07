const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { logExecution } = require('../utils');

class LogNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_LOG,
      name: 'Log Output',
      category: 'action',
      icon: '📋',
      description: 'Logs custom text messages or previous step outputs',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const message = node.data?.message || '';
    const prevData = context.lastOutput;

    let logContent;
    if (message.includes('{{prev}}') && prevData) {
      logContent = message.replace('{{prev}}', JSON.stringify(prevData, null, 2));
    } else if (!message && prevData) {
      logContent = JSON.stringify(prevData, null, 2);
    } else {
      logContent = message || 'Step executed';
    }

    logExecution(logContent);
    return { logged: true, message: logContent, timestamp: new Date().toISOString() };
  }
}

module.exports = LogNode;

const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { logExecution } = require('../utils');
const { resolveVariableWithDetails } = require('../utils/VariableResolver');

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
    const rawMessage = node.data?.message || '';
    const prevData = context.lastOutput;

    let logContent;
    let unresolvedExpressions = [];

    if (!rawMessage) {
      // No message configured: dump the previous step output as pretty JSON
      logContent =
        prevData !== null && prevData !== undefined
          ? JSON.stringify(prevData, null, 2)
          : 'Step executed';
    } else {
      const resolved = resolveVariableWithDetails(rawMessage, context);
      logContent = resolved.value;
      unresolvedExpressions = resolved.unresolved;

      // If the entire message resolved to empty while containing template tokens,
      // preserve the raw template so unresolved output is not silently swallowed.
      if (logContent === '' && rawMessage.includes('{{')) {
        logContent = rawMessage;
      }

      if (unresolvedExpressions.length > 0) {
        console.warn(
          `[LogNode] Unresolved template expression(s) in node "${node.id}": ${unresolvedExpressions.join(', ')}`
        );
      }
    }

    logExecution(logContent);

    const output = {
      logged: true,
      message: logContent,
      timestamp: new Date().toISOString(),
    };

    if (unresolvedExpressions.length > 0) {
      output.hasUnresolvedExpressions = true;
      output.unresolvedExpressions = unresolvedExpressions;
    }

    return output;
  }
}

module.exports = LogNode;

/**
 * Logs a message formatted with timestamp and optional context metadata
 * @param {string} message - Content to log
 * @param {object} [context] - Context metadata { executionId, nodeId, nodeName, nodeType }
 */
function logExecution(message, context = {}) {
  const timestamp = new Date().toISOString();
  const ctxPrefix = context.executionId ? `[Exec:${context.executionId}]` : '';
  const nodePrefix = context.nodeName ? `[Node:${context.nodeName} (${context.nodeType || ''})]` : '';
  console.log(`[LogicBridge Execution ${timestamp}]${ctxPrefix}${nodePrefix} ${message}`);
}

/**
 * Logs an execution error with structured context
 * @param {string} contextName - Name of step or service
 * @param {Error|string} error - Error object or message
 * @param {object} [context] - Context metadata { executionId, nodeId, nodeName, nodeType }
 */
function logError(contextName, error, context = {}) {
  const timestamp = new Date().toISOString();
  const message = typeof error === 'object' ? error.message : error;
  const ctxPrefix = context.executionId ? `[Exec:${context.executionId}]` : '';
  const nodeInfo = context.nodeId ? ` (ID: ${context.nodeId}, Type: ${context.nodeType})` : '';
  console.error(`[LogicBridge Error ${timestamp}]${ctxPrefix} Node "${contextName}"${nodeInfo} failed: ${message}`);
}

module.exports = {
  logExecution,
  logError,
  log: logExecution,
  error: logError,
};

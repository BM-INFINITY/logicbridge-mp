class NodeExecutionError extends Error {
  constructor(message, { nodeId = null, nodeName = null, nodeType = null, originalError = null } = {}) {
    super(message);
    this.name = 'NodeExecutionError';
    this.nodeId = nodeId;
    this.nodeName = nodeName;
    this.nodeType = nodeType;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = NodeExecutionError;

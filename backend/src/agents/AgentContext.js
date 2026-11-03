const { redactSecrets } = require('../utils/secretRedactor');

/**
 * AgentContext — Maintains conversation state, tool calls, and iteration limits during an agent run
 */
class AgentContext {
  constructor({
    agentId,
    systemPrompt = '',
    prompt = '',
    allowedTools = [],
    maxIterations = 10,
    maxToolCalls = 15,
    timeoutMs = 60000,
    allowSensitiveActions = false,
    executionContext = {},
  } = {}) {
    this.agentId = agentId || `agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.systemPrompt = systemPrompt;
    this.prompt = prompt;
    this.allowedTools = Array.isArray(allowedTools) ? allowedTools : [];
    this.maxIterations = Math.min(Math.max(parseInt(maxIterations, 10) || 10, 1), 25);
    this.maxToolCalls = Math.min(Math.max(parseInt(maxToolCalls, 10) || 15, 1), 50);
    this.timeoutMs = parseInt(timeoutMs, 10) || 60000;
    this.allowSensitiveActions = Boolean(allowSensitiveActions);
    this.executionContext = executionContext;

    this.iteration = 0;
    this.toolCallCount = 0;
    this.toolCallsHistory = [];
    this.messages = [];
    this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.startTime = Date.now();
  }

  addMessage(message) {
    if (!message) return;
    this.messages.push(message);
  }

  recordToolCall({ id, tool, arguments: args, result, status, error, durationMs }) {
    this.toolCallCount++;
    const record = {
      id: id || `call_${this.toolCallCount}`,
      tool,
      arguments: redactSecrets(args),
      result: redactSecrets(result),
      status: status || (error ? 'error' : 'success'),
      error: error || null,
      durationMs: durationMs || 0,
      iteration: this.iteration,
    };
    this.toolCallsHistory.push(record);
    return record;
  }

  addUsage(usage) {
    if (!usage) return;
    this.usage.promptTokens += usage.promptTokens || 0;
    this.usage.completionTokens += usage.completionTokens || 0;
    this.usage.totalTokens += usage.totalTokens || 0;
  }

  isTimedOut() {
    return Date.now() - this.startTime >= this.timeoutMs;
  }

  isMaxIterations() {
    return this.iteration >= this.maxIterations;
  }

  isMaxToolCalls() {
    return this.toolCallCount >= this.maxToolCalls;
  }

  canContinue() {
    return !this.isTimedOut() && !this.isMaxIterations() && !this.isMaxToolCalls();
  }
}

module.exports = AgentContext;


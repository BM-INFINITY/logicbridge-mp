/**
 * AgentResult — Standardized final response and execution metadata for an AI Agent run
 */
class AgentResult {
  constructor({
    text = '',
    content = '',
    finalResponse = '',
    structured = null,
    iterations = 0,
    toolCalls = [],
    totalToolCalls = 0,
    provider = '',
    model = '',
    usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason = 'stop',
    executionTimeMs = 0,
    timestamp = new Date().toISOString(),
  } = {}) {
    const mainText = text || content || finalResponse || '';
    this.text = mainText;
    this.content = mainText;
    this.finalResponse = mainText;
    this.structured = structured;
    this.iterations = iterations;
    this.toolCalls = Array.isArray(toolCalls) ? toolCalls : [];
    this.totalToolCalls = totalToolCalls || this.toolCalls.length;
    this.provider = provider;
    this.model = model;
    this.usage = usage;
    this.finishReason = finishReason;
    this.executionTimeMs = executionTimeMs;
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      text: this.text,
      content: this.content,
      finalResponse: this.finalResponse,
      structured: this.structured,
      iterations: this.iterations,
      toolCalls: this.toolCalls,
      totalToolCalls: this.totalToolCalls,
      provider: this.provider,
      model: this.model,
      usage: this.usage,
      finishReason: this.finishReason,
      executionTimeMs: this.executionTimeMs,
      timestamp: this.timestamp,
    };
  }
}

module.exports = AgentResult;


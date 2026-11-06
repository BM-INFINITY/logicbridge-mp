/**
 * Sanitizes reasoning/chain-of-thought blocks (<thought>...</thought> or <thinking>...</thinking>)
 * so internal scratchpad reasoning is not exposed to execution inspectors or logs.
 */
function sanitizeChainOfThought(raw) {
  if (typeof raw !== 'string') return raw;
  return raw
    .replace(/<thought\b[^>]*>[\s\S]*?<\/thought>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .trim();
}

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
    const cleanText = sanitizeChainOfThought(mainText);
    this.text = cleanText;
    this.content = cleanText;
    this.finalResponse = cleanText;
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

AgentResult.sanitizeChainOfThought = sanitizeChainOfThought;

module.exports = AgentResult;


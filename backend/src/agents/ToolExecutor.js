const { toolRegistry } = require('./ToolRegistry');
const { redactSecrets } = require('../utils/secretRedactor');

const MAX_TOOL_OUTPUT_BYTES = 32 * 1024; // 32KB max output per tool call

/**
 * Sanitizes tool output to prevent prompt injection attacks
 * from external web content or files trying to impersonate system instructions
 */
function sanitizeToolOutput(rawStr) {
  if (typeof rawStr !== 'string') return rawStr;
  return rawStr
    .replace(/<system\b[^>]*>/gi, '&lt;system&gt;')
    .replace(/<\/system>/gi, '&lt;/system&gt;')
    .replace(/\[INST\]/gi, '&#91;INST&#93;')
    .replace(/\[\/INST\]/gi, '&#91;/INST&#93;')
    .replace(/<<SYS>>/gi, '&lt;&lt;SYS&gt;&gt;')
    .replace(/<\/SYS>>/gi, '&lt;/SYS&gt;&gt;')
    .replace(/^(system|assistant|user):/gim, '$1 (external text):');
}

/**
 * ToolExecutor — Validates, authorizes, and safely executes agent tool calls
 */
class ToolExecutor {
  /**
   * Executes a tool with security boundaries, allowlist checks, and prompt injection mitigation
   *
   * @param {string} toolName - Tool identifier
   * @param {object} toolArgs - Tool invocation arguments
   * @param {AgentContext} agentContext - Current agent execution context
   * @param {object} [options] - Additional execution options
   * @returns {Promise<object>} Standardized tool execution result
   */
  static async executeTool(toolName, toolArgs = {}, agentContext, options = {}) {
    const startTime = Date.now();
    const normalizedName = String(toolName || '').toLowerCase().trim();

    // 1. Tool Allowlist Check
    const allowed = agentContext?.allowedTools || [];
    const isAllowed = allowed.some((t) => String(t).toLowerCase().trim() === normalizedName);

    if (!isAllowed) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Tool "${normalizedName}" is not authorized for this agent. Allowed: ${allowed.join(', ')}`;
      return {
        ok: false,
        result: null,
        error: errorMsg,
        durationMs,
        observation: `<tool_observation tool="${normalizedName}" status="error">\n${errorMsg}\n</tool_observation>`,
      };
    }

    // 2. Tool Existence Check
    const tool = toolRegistry.getTool(normalizedName);
    if (!tool) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Tool "${normalizedName}" is not registered in the system.`;
      return {
        ok: false,
        result: null,
        error: errorMsg,
        durationMs,
        observation: `<tool_observation tool="${normalizedName}" status="error">\n${errorMsg}\n</tool_observation>`,
      };
    }

    // 3. Sensitive / Destructive Action Safeguard
    const isSensitive =
      tool.sensitive ||
      (typeof tool.isSensitiveOperation === 'function' && tool.isSensitiveOperation(toolArgs));

    if (isSensitive && !agentContext?.allowSensitiveActions) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Action blocked: Tool "${normalizedName}" performs a sensitive/destructive operation requiring explicit approval (allowSensitiveActions: true).`;
      return {
        ok: false,
        result: null,
        error: errorMsg,
        durationMs,
        sensitive: true,
        observation: `<tool_observation tool="${normalizedName}" status="denied">\n${errorMsg}\n</tool_observation>`,
      };
    }

    // 4. Schema Argument Validation
    const validation = toolRegistry.validateToolArgs(normalizedName, toolArgs);
    if (!validation.valid) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Argument validation failed for "${normalizedName}": ${validation.error}`;
      return {
        ok: false,
        result: null,
        error: errorMsg,
        durationMs,
        observation: `<tool_observation tool="${normalizedName}" status="error">\n${errorMsg}\n</tool_observation>`,
      };
    }

    // 5. Execution with Timeout & Secret Redaction
    const timeoutMs = options.timeoutMs || 20000;
    let timer = null;
    try {
      const executionPromise = tool.handler(toolArgs, agentContext?.executionContext || {});
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tool "${normalizedName}" timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const rawResult = await Promise.race([executionPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      // Bound and redact payload
      const redactedResult = redactSecrets(rawResult);
      let serialized = typeof redactedResult === 'object' ? JSON.stringify(redactedResult, null, 2) : String(redactedResult ?? '');

      if (Buffer.byteLength(serialized, 'utf8') > MAX_TOOL_OUTPUT_BYTES) {
        serialized = serialized.substring(0, MAX_TOOL_OUTPUT_BYTES) + '\n... [Tool output truncated to 32KB to protect context window]';
      }

      const sanitizedObservation = sanitizeToolOutput(serialized);

      return {
        ok: true,
        result: redactedResult,
        error: null,
        durationMs,
        sensitive: isSensitive,
        observation: `<tool_observation tool="${normalizedName}" status="success">\n${sanitizedObservation}\n</tool_observation>`,
      };
    } catch (err) {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const safeErrorMsg = redactSecrets(err.message || 'Unknown tool error');

      return {
        ok: false,
        result: null,
        error: safeErrorMsg,
        durationMs,
        sensitive: isSensitive,
        observation: `<tool_observation tool="${normalizedName}" status="error">\n${safeErrorMsg}\n</tool_observation>`,
      };
    }
  }
}

module.exports = ToolExecutor;

/**
 * Utility function for resolving mustache variable expressions in node fields
 * e.g. {{ steps.step_1.data }}, {{ prev.fieldName }}, or {{ trigger.body.user }}
 */

function getNestedValue(obj, pathStr) {
  if (obj === null || obj === undefined) return undefined;
  if (pathStr === undefined || pathStr === null || String(pathStr).trim() === '') return obj;
  const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Interpolates {{ expression }} variables in template strings against context
 *
 * @param {string} str - Input template string containing {{ expression }}
 * @param {object|ExecutionContext} context - ExecutionContext or previous step output
 * @returns {string} - Interpolated string with resolved variable values
 */
function resolveVariable(str, context) {
  if (typeof str !== 'string') return str;
  if (!str.includes('{{')) return str;

  return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, rawPath) => {
    const trimmedPath = rawPath.trim();
    if (!trimmedPath) return match;

    let val;

    const isContextObj =
      context &&
      typeof context === 'object' &&
      (context.results ||
        context.lastOutput ||
        context.triggerPayload ||
        context.triggerContext ||
        typeof context.getResult === 'function');

    if (isContextObj) {
      // 1. Check trigger reference: {{ trigger.xxx }}, {{ triggerContext.xxx }}, {{ triggerPayload.xxx }}
      if (/^(trigger|triggerContext|triggerPayload)(\.|$)/i.test(trimmedPath)) {
        const pathAfterTrigger = trimmedPath.replace(/^(trigger|triggerContext|triggerPayload)\.?/i, '');
        const triggerKey = Object.keys(context.results || {}).find((k) => /^trigger/i.test(k));
        const triggerData =
          context.triggerPayload ||
          context.triggerContext?.payload ||
          context.triggerContext ||
          context.results?.trigger ||
          context.results?.node_trigger ||
          (triggerKey ? context.results[triggerKey] : undefined);
        val = getNestedValue(triggerData, pathAfterTrigger);
      }

      // 2. Check step/node reference: {{ steps.node_1.data }}, {{ step_1.data }}, {{ n1.data }}
      if (val === undefined) {
        const stepMatch = trimmedPath.match(/^(?:steps?\.)?([a-zA-Z0-9_-]+)(?:\.(.+))?$/);
        if (stepMatch) {
          const nodeId = stepMatch[1];
          const subPath = stepMatch[2];
          const nodeResult =
            context.results?.[nodeId] ??
            (typeof context.getResult === 'function' ? context.getResult(nodeId) : undefined);

          if (nodeResult !== undefined) {
            val = subPath ? getNestedValue(nodeResult, subPath) : nodeResult;
          }
        }
      }

      // 3. Check prev reference: {{ prev.field }}
      if (val === undefined && /^prev(\.|$)/i.test(trimmedPath)) {
        const subPath = trimmedPath.replace(/^prev\.?/i, '');
        const lastOut =
          context.lastOutput ??
          (typeof context.getLastOutput === 'function' ? context.getLastOutput() : undefined);
        val = subPath ? getNestedValue(lastOut, subPath) : lastOut;
        if (val === undefined && lastOut?.data) {
          val = subPath ? getNestedValue(lastOut.data, subPath) : lastOut.data;
        }
      }

      // 4. Fallback to lastOutput or direct context lookup
      if (val === undefined) {
        const lastOut =
          context.lastOutput ??
          (typeof context.getLastOutput === 'function' ? context.getLastOutput() : undefined);
        if (lastOut) {
          val = getNestedValue(lastOut, trimmedPath);
          if (val === undefined && lastOut.data) {
            val = getNestedValue(lastOut.data, trimmedPath);
          }
        }
      }
    } else {
      // Context is a plain object (e.g. previous step output or dataset object)
      const cleanPath = trimmedPath.replace(/^(step_\w+|prev)\./, '');
      val = getNestedValue(context, cleanPath);
      if (val === undefined && context?.data) {
        val = getNestedValue(context.data, cleanPath);
      }
      if (val === undefined) {
        val = getNestedValue(context, trimmedPath);
      }
    }

    if (val !== undefined && val !== null) {
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    }

    return '';
  });
}

module.exports = {
  resolveVariable,
  resolve: resolveVariable,
};

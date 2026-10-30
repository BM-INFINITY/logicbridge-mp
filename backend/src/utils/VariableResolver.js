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
        context.loopStack ||
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

      // 2. Check active loop context: {{ loop.item }}, {{ loop.index }}, {{ loop.batch }}, {{ loop.total }}, etc.
      const loopCtx = context.loopContext || context.currentLoop || (Array.isArray(context.loopStack) && context.loopStack.length > 0 ? context.loopStack[context.loopStack.length - 1] : null);

      if (val === undefined && /^loop(\.|$)/i.test(trimmedPath)) {
        const subPath = trimmedPath.replace(/^loop\.?/i, '');
        if (loopCtx) {
          val = subPath ? getNestedValue(loopCtx, subPath) : loopCtx;
        }
      }

      // 2b. Direct iteration shortcuts: {{ item }}, {{ item.field }}, {{ index }}
      if (val === undefined && /^item(\.|$)/i.test(trimmedPath)) {
        const subPath = trimmedPath.replace(/^item\.?/i, '');
        if (loopCtx && loopCtx.item !== undefined) {
          val = subPath ? getNestedValue(loopCtx.item, subPath) : loopCtx.item;
        }
      }
      if (val === undefined && trimmedPath === 'index') {
        if (loopCtx && loopCtx.index !== undefined) {
          val = loopCtx.index;
        }
      }

      // 3. Check step/node reference: {{ steps.node_1.data }}, {{ step_1.data }}, {{ n1.data }}
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

      // 4. Check prev reference: {{ prev.field }}
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

      // 5. Fallback to lastOutput or direct context lookup
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

/**
 * Resolves a variable expression directly to its raw underlying data type (Array, Object, Number, etc.)
 * If expression is a single mustache block {{ path }}, preserves exact object reference.
 * If expression is a compound string with multiple blocks or literals, falls back to resolveVariable string interpolation.
 *
 * @param {any} expr - Input expression or value
 * @param {object|ExecutionContext} context
 * @returns {any}
 */
function resolveRawValue(expr, context) {
  if (expr === null || expr === undefined) return expr;
  if (typeof expr !== 'string') return expr;

  const trimmed = expr.trim();
  const singleMatch = trimmed.match(/^\{\{\s*([^}]+)\s*\}\}$/);
  if (!singleMatch) {
    return resolveVariable(expr, context);
  }

  const rawPath = singleMatch[1].trim();
  let val;

  const isContextObj =
    context &&
    typeof context === 'object' &&
    (context.results ||
      context.lastOutput ||
      context.triggerPayload ||
      context.triggerContext ||
      context.loopStack ||
      typeof context.getResult === 'function');

  if (isContextObj) {
    if (/^(trigger|triggerContext|triggerPayload)(\.|$)/i.test(rawPath)) {
      const pathAfterTrigger = rawPath.replace(/^(trigger|triggerContext|triggerPayload)\.?/i, '');
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

    const loopCtx = context.loopContext || context.currentLoop || (Array.isArray(context.loopStack) && context.loopStack.length > 0 ? context.loopStack[context.loopStack.length - 1] : null);

    if (val === undefined && /^loop(\.|$)/i.test(rawPath)) {
      const subPath = rawPath.replace(/^loop\.?/i, '');
      if (loopCtx) {
        val = subPath ? getNestedValue(loopCtx, subPath) : loopCtx;
      }
    }

    if (val === undefined && /^item(\.|$)/i.test(rawPath)) {
      const subPath = rawPath.replace(/^item\.?/i, '');
      if (loopCtx && loopCtx.item !== undefined) {
        val = subPath ? getNestedValue(loopCtx.item, subPath) : loopCtx.item;
      }
    }

    if (val === undefined && rawPath === 'index') {
      if (loopCtx && loopCtx.index !== undefined) {
        val = loopCtx.index;
      }
    }

    if (val === undefined) {
      const stepMatch = rawPath.match(/^(?:steps?\.)?([a-zA-Z0-9_-]+)(?:\.(.+))?$/);
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

    if (val === undefined && /^prev(\.|$)/i.test(rawPath)) {
      const subPath = rawPath.replace(/^prev\.?/i, '');
      const lastOut =
        context.lastOutput ??
        (typeof context.getLastOutput === 'function' ? context.getLastOutput() : undefined);
      val = subPath ? getNestedValue(lastOut, subPath) : lastOut;
      if (val === undefined && lastOut?.data) {
        val = subPath ? getNestedValue(lastOut.data, subPath) : lastOut.data;
      }
    }

    if (val === undefined) {
      const lastOut =
        context.lastOutput ??
        (typeof context.getLastOutput === 'function' ? context.getLastOutput() : undefined);
      if (lastOut) {
        val = getNestedValue(lastOut, rawPath);
        if (val === undefined && lastOut.data) {
          val = getNestedValue(lastOut.data, rawPath);
        }
      }
    }
  } else {
    const cleanPath = rawPath.replace(/^(step_\w+|prev)\./, '');
    val = getNestedValue(context, cleanPath);
    if (val === undefined && context?.data) {
      val = getNestedValue(context.data, cleanPath);
    }
    if (val === undefined) {
      val = getNestedValue(context, rawPath);
    }
  }

  return val !== undefined ? val : '';
}

module.exports = {
  resolveVariable,
  resolveRawValue,
  resolve: resolveVariable,
};

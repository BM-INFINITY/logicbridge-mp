/**
 * Utility function for resolving mustache variable expressions in node fields
 * e.g. {{ steps.step_1.data }}, {{ prev.fieldName }}, or {{ trigger.body.user }}
 */

const BLOCKED_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

function getNestedValue(obj, pathStr) {
  if (obj === null || obj === undefined) return undefined;
  if (pathStr === undefined || pathStr === null || String(pathStr).trim() === '') return obj;
  const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (BLOCKED_PROPS.has(part.toLowerCase())) return undefined;
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

      // 2c. Workflow Variables: {{ variables.xxx }}, {{ variable.xxx }}, {{ vars.xxx }}
      if (val === undefined && /^(variables|variable|vars)(\.|$)/i.test(trimmedPath)) {
        const varPath = trimmedPath.replace(/^(variables|variable|vars)\.?/i, '');
        const varsObj = context.variables || (typeof context.getVariable === 'function' ? null : undefined);
        if (varsObj) {
          val = getNestedValue(varsObj, varPath);
        } else if (typeof context.getVariable === 'function') {
          const parts = varPath.split('.');
          const first = parts[0];
          const rest = parts.slice(1).join('.');
          const baseVar = context.getVariable(first);
          val = rest ? getNestedValue(baseVar, rest) : baseVar;
        }
      }

      // 2d. Workflow Secrets: {{ secrets.xxx }}, {{ secret.xxx }}
      if (val === undefined && /^(secrets|secret)(\.|$)/i.test(trimmedPath)) {
        const secretPath = trimmedPath.replace(/^(secrets|secret)\.?/i, '');
        const secretsObj = context.secrets || (typeof context.getSecret === 'function' ? null : undefined);
        if (secretsObj) {
          val = getNestedValue(secretsObj, secretPath);
        } else if (typeof context.getSecret === 'function') {
          const parts = secretPath.split('.');
          const first = parts[0];
          const rest = parts.slice(1).join('.');
          const baseSecret = context.getSecret(first);
          val = rest ? getNestedValue(baseSecret, rest) : baseSecret;
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

      // 5b. Fallback to workflow variables (bare name)
      if (val === undefined && context.variables) {
        val = getNestedValue(context.variables, trimmedPath);
      }
    } else {
      // Context is a plain object (e.g. previous step output or dataset object)
      if (/^(variables|variable|vars)\./i.test(trimmedPath) && context.variables) {
        const varPath = trimmedPath.replace(/^(variables|variable|vars)\./i, '');
        val = getNestedValue(context.variables, varPath);
      } else if (/^(secrets|secret)\./i.test(trimmedPath) && context.secrets) {
        const secretPath = trimmedPath.replace(/^(secrets|secret)\./i, '');
        val = getNestedValue(context.secrets, secretPath);
      } else {
        const cleanPath = trimmedPath.replace(/^(step_\w+|prev)\./, '');
        val = getNestedValue(context, cleanPath);
        if (val === undefined && context?.data) {
          val = getNestedValue(context.data, cleanPath);
        }
        if (val === undefined) {
          val = getNestedValue(context, trimmedPath);
        }
        if (val === undefined && context.variables) {
          val = getNestedValue(context.variables, trimmedPath);
        }
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

    // 2c. Workflow Variables: {{ variables.xxx }}, {{ variable.xxx }}, {{ vars.xxx }}
    if (val === undefined && /^(variables|variable|vars)(\.|$)/i.test(rawPath)) {
      const varPath = rawPath.replace(/^(variables|variable|vars)\.?/i, '');
      const varsObj = context.variables || (typeof context.getVariable === 'function' ? null : undefined);
      if (varsObj) {
        val = getNestedValue(varsObj, varPath);
      } else if (typeof context.getVariable === 'function') {
        const parts = varPath.split('.');
        const first = parts[0];
        const rest = parts.slice(1).join('.');
        const baseVar = context.getVariable(first);
        val = rest ? getNestedValue(baseVar, rest) : baseVar;
      }
    }

    // 2d. Workflow Secrets: {{ secrets.xxx }}, {{ secret.xxx }}
    if (val === undefined && /^(secrets|secret)(\.|$)/i.test(rawPath)) {
      const secretPath = rawPath.replace(/^(secrets|secret)\.?/i, '');
      const secretsObj = context.secrets || (typeof context.getSecret === 'function' ? null : undefined);
      if (secretsObj) {
        val = getNestedValue(secretsObj, secretPath);
      } else if (typeof context.getSecret === 'function') {
        const parts = secretPath.split('.');
        const first = parts[0];
        const rest = parts.slice(1).join('.');
        const baseSecret = context.getSecret(first);
        val = rest ? getNestedValue(baseSecret, rest) : baseSecret;
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

    // Fallback to workflow variables (bare name)
    if (val === undefined && context.variables) {
      val = getNestedValue(context.variables, rawPath);
    }
  } else {
    // Context is a plain object
    if (/^(variables|variable|vars)\./i.test(rawPath) && context.variables) {
      const varPath = rawPath.replace(/^(variables|variable|vars)\./i, '');
      val = getNestedValue(context.variables, varPath);
    } else if (/^(secrets|secret)\./i.test(rawPath) && context.secrets) {
      const secretPath = rawPath.replace(/^(secrets|secret)\./i, '');
      val = getNestedValue(context.secrets, secretPath);
    } else {
      const cleanPath = rawPath.replace(/^(step_\w+|prev)\./, '');
      val = getNestedValue(context, cleanPath);
      if (val === undefined && context?.data) {
        val = getNestedValue(context.data, cleanPath);
      }
      if (val === undefined) {
        val = getNestedValue(context, rawPath);
      }
      if (val === undefined && context.variables) {
        val = getNestedValue(context.variables, rawPath);
      }
    }
  }

  return val !== undefined ? val : '';
}

module.exports = {
  resolveVariable,
  resolveRawValue,
  resolve: resolveVariable,
};

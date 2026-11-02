const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { NodeExecutionError } = require('../errors');
const { resolveRawValue, resolveVariable } = require('../utils/VariableResolver');
const { parseCsv } = require('../utils/FileSecurity');

const DEFAULT_MAX_ITERATIONS = 500;
const ABSOLUTE_MAX_ITERATIONS = 2000;

/**
 * LoopNode — Executes iterative and batch processing across collection items or ranges
 */
class LoopNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_LOOP,
      name: 'Loop / Batch',
      category: 'logic',
      icon: 'Repeat',
      description: 'Iterates through arrays or batches of items and executes connected actions',
    });
  }

  /**
   * Validates loop configuration before execution
   * @param {object} node
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(node) {
    const data = node.data || {};
    const validOps = ['loop_items', 'loop_batch', 'loop_range'];
    const op = String(data.operation || 'loop_items').toLowerCase().trim();

    if (!validOps.includes(op)) {
      return { valid: false, error: `Invalid loop operation "${data.operation}". Supported: ${validOps.join(', ')}` };
    }

    if (op === 'loop_items' || op === 'loop_batch') {
      const hasInput = data.items !== undefined || data.collection !== undefined || data.array !== undefined || data.input !== undefined;
      if (!hasInput) {
        return { valid: false, error: 'Input collection or array expression is required for Loop' };
      }
    }

    if (op === 'loop_range') {
      const count = data.count ?? data.times ?? data.stop;
      if (count === undefined || count === null || String(count).trim() === '') {
        return { valid: false, error: 'Count or range limit is required for Loop Range' };
      }
    }

    if (data.batchSize !== undefined && data.batchSize !== null && data.batchSize !== '') {
      const bs = parseInt(data.batchSize, 10);
      if (isNaN(bs) || bs < 1) {
        return { valid: false, error: 'Batch size must be a positive integer greater than or equal to 1' };
      }
    }

    if (data.maxIterations !== undefined && data.maxIterations !== null && data.maxIterations !== '') {
      const mi = parseInt(data.maxIterations, 10);
      if (isNaN(mi) || mi < 1) {
        return { valid: false, error: 'Maximum iterations must be a positive integer' };
      }
    }

    return { valid: true };
  }

  /**
   * Resolves and extracts an array from node configuration or execution context
   * @param {object} data - Node data
   * @param {object} context - ExecutionContext
   * @returns {Array<any>} Array of items
   */
  extractItems(data, context) {
    const op = String(data.operation || 'loop_items').toLowerCase().trim();

    if (op === 'loop_range') {
      const rawCount = data.count ?? data.times ?? data.stop;
      const resolvedCount = typeof rawCount === 'string' ? resolveVariable(rawCount, context) : rawCount;
      const count = Math.min(Math.max(0, parseInt(resolvedCount, 10) || 0), ABSOLUTE_MAX_ITERATIONS);
      const start = data.start !== undefined ? parseInt(resolveVariable(String(data.start), context), 10) || 0 : 0;
      const step = data.step !== undefined ? Math.max(1, parseInt(resolveVariable(String(data.step), context), 10) || 1) : 1;

      const items = [];
      for (let i = start; items.length < count; i += step) {
        items.push(i);
      }
      return items;
    }

    const rawInput = data.items !== undefined ? data.items : (data.collection !== undefined ? data.collection : (data.array !== undefined ? data.array : data.input));

    // If input is null/undefined
    if (rawInput === undefined || rawInput === null) {
      return [];
    }

    // Direct JS Array
    if (Array.isArray(rawInput)) {
      return rawInput;
    }

    // Resolve variable if expression
    let resolved = rawInput;
    if (typeof rawInput === 'string') {
      resolved = resolveRawValue(rawInput, context);
      if (Array.isArray(resolved)) {
        return resolved;
      }
    }

    // If resolved to an Array directly
    if (Array.isArray(resolved)) {
      return resolved;
    }

    // Try parsing string as JSON or CSV
    if (typeof resolved === 'string') {
      const trimmed = resolved.trim();
      if (trimmed === '') return [];

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Fall through
        }
      }

      // Check for newline-delimited or comma-delimited strings
      if (trimmed.includes('\n') || trimmed.includes(',')) {
        try {
          const parsedCsv = parseCsv(trimmed);
          if (Array.isArray(parsedCsv) && parsedCsv.length > 0) {
            return parsedCsv;
          }
        } catch {
          // Fall through
        }
        return trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      }

      return [trimmed];
    }

    // If resolved to an object with common array keys
    if (typeof resolved === 'object' && resolved !== null) {
      if (Array.isArray(resolved.records)) return resolved.records;
      if (Array.isArray(resolved.items)) return resolved.items;
      if (Array.isArray(resolved.data)) return resolved.data;
      if (Array.isArray(resolved.results)) return resolved.results;
      if (Array.isArray(resolved.users)) return resolved.users;
      if (Array.isArray(resolved.rows)) return resolved.rows;
      return [resolved];
    }

    if (typeof resolved === 'number' || typeof resolved === 'boolean') {
      return [resolved];
    }

    return [];
  }

  /**
   * Partitions an array of items into chunks of batchSize
   * @param {Array} items
   * @param {number} batchSize
   * @returns {Array<Array>} Array of batches
   */
  partitionBatches(items, batchSize = 1) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const size = Math.max(1, parseInt(batchSize, 10) || 1);
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  /**
   * Executes the loop node.
   * Coordinates iteration over items or batches, exposes context variables,
   * invokes body executor if provided, and aggregates iteration outputs.
   *
   * @param {object} node
   * @param {object} context
   * @param {object} [options]
   * @param {Function} [options.executeBody] - Callback: async (iterationState) => iterationResult
   * @returns {Promise<object>}
   */
  async execute(node, context, options = {}) {
    const startedAt = Date.now();
    const data = node.data || {};

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const items = this.extractItems(data, context);
    const batchSize = Math.max(1, parseInt(data.batchSize, 10) || 1);
    const configuredLimit = parseInt(data.maxIterations, 10);
    const maxIterations = !isNaN(configuredLimit) && configuredLimit > 0
      ? Math.min(configuredLimit, ABSOLUTE_MAX_ITERATIONS)
      : DEFAULT_MAX_ITERATIONS;

    const onError = String(data.onError || 'stop').toLowerCase().trim();
    const isContinueOnError = onError === 'continue' || onError === 'continue_on_error';

    const batches = this.partitionBatches(items, batchSize);
    const totalItems = items.length;
    const isBatchMode = batchSize > 1 || data.operation === 'loop_batch';

    // Fast-path: empty array
    if (totalItems === 0) {
      return {
        ok: true,
        operation: data.operation || 'loop_items',
        total: 0,
        iterations: 0,
        batchCount: 0,
        batchSize,
        results: [],
        errors: [],
        selectedBranch: BranchTypes.DONE,
        completed: true,
        duration: Date.now() - startedAt,
      };
    }

    const units = isBatchMode ? batches : items;

    if (units.length > maxIterations) {
      throw new NodeExecutionError(
        `Loop iteration limit exceeded: attempting ${units.length} iterations, maximum permitted is ${maxIterations}`,
        { nodeId: node.id, nodeType: this.type }
      );
    }

    const results = [];
    const errors = [];
    let completedCount = 0;
    let brokenEarly = false;

    const executeBodyFn = options.executeBody || options._executeBody;

    for (let idx = 0; idx < units.length; idx++) {
      const unit = units[idx];
      const isLast = idx === units.length - 1;
      const isFirst = idx === 0;

      const currentItem = isBatchMode ? unit[0] : unit;
      const currentBatch = isBatchMode ? unit : [unit];

      const iterationState = {
        item: currentItem,
        index: idx,
        batch: currentBatch,
        batchIndex: idx,
        batchSize,
        total: units.length,
        totalItems,
        isFirst,
        isLast,
        loopNodeId: node.id,
      };

      if (typeof context?.pushLoopContext === 'function') {
        context.pushLoopContext(iterationState);
      } else if (context) {
        context.loopContext = iterationState;
      }

      try {
        let iterationOutput = null;
        if (typeof executeBodyFn === 'function') {
          iterationOutput = await executeBodyFn(iterationState);
        } else {
          // Default output if no external body executor attached (e.g. unit tests or standalone)
          iterationOutput = {
            index: idx,
            item: currentItem,
            batch: isBatchMode ? currentBatch : undefined,
          };
        }

        results.push(iterationOutput);
        completedCount++;

        // Support break signal from loop body output
        if (iterationOutput && (iterationOutput.break === true || iterationOutput.action === 'break')) {
          brokenEarly = true;
          break;
        }
      } catch (err) {
        errors.push({ index: idx, item: currentItem, error: err.message });
        if (!isContinueOnError) {
          throw new NodeExecutionError(
            `Loop failed at iteration ${idx}: ${err.message}`,
            { nodeId: node.id, nodeType: this.type, originalError: err }
          );
        }
        // If continue_on_error, push error result and proceed
        results.push({ _error: err.message, _failed: true, index: idx });
      } finally {
        if (typeof context?.popLoopContext === 'function') {
          context.popLoopContext();
        }
      }
    }

    return {
      ok: errors.length === 0 || isContinueOnError,
      operation: data.operation || 'loop_items',
      total: totalItems,
      iterations: completedCount,
      batchCount: batches.length,
      batchSize,
      results,
      errors: errors.length > 0 ? errors : undefined,
      errorCount: errors.length,
      brokenEarly,
      selectedBranch: BranchTypes.DONE,
      completed: true,
      duration: Date.now() - startedAt,
    };
  }
}

module.exports = LoopNode;

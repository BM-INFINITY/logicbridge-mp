const crypto = require('crypto');
const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { resolveVariable } = require('../utils/VariableResolver');
const { NodeExecutionError } = require('../errors');
const ExecutionPauseSignal = require('../errors/ExecutionPauseSignal');

/**
 * WaitNode — Durable pause for a duration, date/time target, or external resume event.
 */
class WaitNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_WAIT,
      name: 'Wait / Delay',
      category: 'action',
      icon: 'Clock',
      description: 'Durable wait for a specified duration, timestamp, or external webhook event',
      version: '1.0.0',
    });
  }

  /**
   * Validates wait node configuration
   * @param {object} node
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(node) {
    const data = node.data || {};
    const waitType = String(data.waitType || data.type || 'duration').toLowerCase().trim();

    if (!['duration', 'date', 'event'].includes(waitType)) {
      return { valid: false, error: 'Wait type must be one of: duration, date, event' };
    }

    if (waitType === 'duration') {
      const dur = data.durationSeconds ?? data.seconds ?? data.duration;
      if (dur === undefined || dur === null || String(dur).trim() === '') {
        return { valid: false, error: 'Duration in seconds is required for Wait duration' };
      }
    } else if (waitType === 'date') {
      const dt = data.waitUntil ?? data.date ?? data.datetime;
      if (!dt || String(dt).trim() === '') {
        return { valid: false, error: 'Target timestamp (waitUntil) is required for Wait date' };
      }
    } else if (waitType === 'event') {
      const ev = data.eventName ?? data.event;
      if (!ev || String(ev).trim() === '') {
        return { valid: false, error: 'Event name is required for Wait event' };
      }
    }

    return { valid: true };
  }

  /**
   * Executes or pauses the wait step
   * @param {object} node
   * @param {object} context
   * @returns {object}
   */
  async execute(node, context) {
    const data = node.data || {};
    const waitType = String(data.waitType || data.type || 'duration').toLowerCase().trim();

    // Check if this node is resuming after delay expiration or external event callback
    const resuming = context.resumingWait;
    if (resuming && (resuming.nodeId === node.id || !resuming.nodeId)) {
      const isTimeout = resuming.status === 'timeout';
      return {
        waitId: resuming.waitId || `wait_${Date.now()}`,
        nodeId: node.id,
        type: waitType,
        status: isTimeout ? 'timeout' : 'resumed',
        resumedAt: resuming.resumedAt || new Date().toISOString(),
        resumedBy: resuming.resumedBy || 'system',
        payload: resuming.resumePayload || {},
        selectedBranch: isTimeout ? BranchTypes.TIMEOUT : BranchTypes.RESUMED,
        resumed: true,
      };
    }

    const waitId = `wait_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (waitType === 'duration') {
      const rawSecs = data.durationSeconds ?? data.seconds ?? data.duration ?? 60;
      const resolvedSecs = parseInt(resolveVariable(String(rawSecs), context), 10);
      const durationSeconds = !isNaN(resolvedSecs) && resolvedSecs >= 0 ? resolvedSecs : 60;
      const waitUntil = new Date(Date.now() + durationSeconds * 1000);

      throw new ExecutionPauseSignal('wait', {
        waitId,
        nodeId: node.id,
        type: 'duration',
        durationSeconds,
        waitUntil,
      });
    }

    if (waitType === 'date') {
      const rawDate = data.waitUntil ?? data.date ?? data.datetime;
      const resolvedDateStr = resolveVariable(String(rawDate), context);
      const waitUntil = new Date(resolvedDateStr);
      if (isNaN(waitUntil.getTime())) {
        throw new NodeExecutionError(`Invalid target date for wait: "${resolvedDateStr}"`);
      }

      throw new ExecutionPauseSignal('wait', {
        waitId,
        nodeId: node.id,
        type: 'date',
        waitUntil,
      });
    }

    if (waitType === 'event') {
      const rawEvent = data.eventName ?? data.event ?? 'external_event';
      const eventName = resolveVariable(String(rawEvent), context);
      const rawTimeoutMin = data.timeoutMinutes;
      let timeoutAt = null;
      if (rawTimeoutMin !== undefined && rawTimeoutMin !== null && String(rawTimeoutMin).trim() !== '') {
        const timeoutMinutes = parseInt(resolveVariable(String(rawTimeoutMin), context), 10);
        if (!isNaN(timeoutMinutes) && timeoutMinutes > 0) {
          timeoutAt = new Date(Date.now() + timeoutMinutes * 60000);
        }
      }
      const resumeToken = crypto.randomBytes(24).toString('hex');

      throw new ExecutionPauseSignal('wait', {
        waitId,
        nodeId: node.id,
        type: 'event',
        eventName,
        resumeToken,
        timeoutAt,
      });
    }
  }
}

module.exports = WaitNode;

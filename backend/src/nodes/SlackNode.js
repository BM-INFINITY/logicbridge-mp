const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable, redactSecrets } = require('../utils');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');
const axios = require('axios');

/**
 * SlackNode — Slack messaging and channel management node.
 * Supports:
 *   - Send Channel Message (markdown, threading)
 *   - Send Direct Message (auto-opens DM conversation)
 *   - Send Rich Message / Blocks (Block Kit)
 *   - Get Channel Information
 */
class SlackNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_SLACK,
      name: 'Slack',
      category: 'action',
      icon: 'MessageSquare',
      description: 'Send messages, direct messages, rich Block Kit layouts, and query channels in Slack',
      version: '1.0.0',
    });
  }

  /**
   * Normalizes operation alias names to canonical keys
   * @param {string} op
   * @returns {string}
   */
  _normalizeOp(op = '') {
    const raw = String(op).toLowerCase().trim().replace(/[-_\s]+/g, '_');
    if (['send_message', 'send_channel_message', 'post_message', 'message'].includes(raw)) return 'send_message';
    if (['send_dm', 'direct_message', 'dm'].includes(raw)) return 'send_dm';
    if (['send_blocks', 'blocks', 'rich_message'].includes(raw)) return 'send_blocks';
    if (['get_channel', 'channel_info', 'get_channel_info', 'channel'].includes(raw)) return 'get_channel';
    return raw;
  }

  validate(node) {
    const data = node?.data || {};
    const { connectionId, token } = data;
    const operation = this._normalizeOp(data.operation || 'send_message');

    if (!connectionId && !token) {
      return { valid: false, error: 'Slack connection is required' };
    }

    const validOps = ['send_message', 'send_dm', 'send_blocks', 'get_channel'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${data.operation}". Supported: ${validOps.join(', ')}` };
    }

    if (operation === 'send_message') {
      if (!data.channel || !String(data.channel).trim()) {
        return { valid: false, error: 'Destination channel is required for Send Message' };
      }
      if (!data.text && !data.message) {
        return { valid: false, error: 'Message text is required for Send Message' };
      }
    }

    if (operation === 'send_dm') {
      if (!data.userId && !data.user) {
        return { valid: false, error: 'User ID is required for Send Direct Message' };
      }
      if (!data.text && !data.message) {
        return { valid: false, error: 'Message text is required for Send Direct Message' };
      }
    }

    if (operation === 'send_blocks') {
      if (!data.channel || !String(data.channel).trim()) {
        return { valid: false, error: 'Destination channel is required for Send Blocks' };
      }
      if (!data.blocks && !data.text && !data.message) {
        return { valid: false, error: 'Blocks or fallback text is required for Send Blocks' };
      }
    }

    if (operation === 'get_channel') {
      if (!data.channel && !data.channelId) {
        return { valid: false, error: 'Channel ID is required for Get Channel Info' };
      }
    }

    return { valid: true };
  }

  /**
   * Safe recursive variable resolution in blocks object or array
   */
  _resolveBlocks(blocks, context) {
    if (!blocks) return [];
    if (typeof blocks === 'string') {
      const resolved = resolveVariable(blocks, context);
      try {
        const parsed = JSON.parse(resolved);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [{ type: 'section', text: { type: 'mrkdwn', text: resolved } }];
      }
    }

    if (Array.isArray(blocks)) {
      return blocks.map((b) => this._resolveBlocks(b, context));
    }

    if (typeof blocks === 'object' && blocks !== null) {
      const result = {};
      for (const [k, v] of Object.entries(blocks)) {
        if (typeof v === 'string') {
          result[k] = resolveVariable(v, context);
        } else if (typeof v === 'object' && v !== null) {
          result[k] = this._resolveBlocks(v, context);
        } else {
          result[k] = v;
        }
      }
      return result;
    }

    return blocks;
  }

  /**
   * Execute an HTTP call to Slack with rate limit retries (HTTP 429) and timeout handling
   */
  async _callSlackApi(endpoint, payload, token, httpClient = axios, method = 'POST') {
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const isGet = method.toUpperCase() === 'GET';
        const url = isGet && payload
          ? `https://slack.com/api/${endpoint}?${new URLSearchParams(payload).toString()}`
          : `https://slack.com/api/${endpoint}`;

        const config = {
          method,
          url,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 15000,
        };

        if (!isGet && payload) {
          config.data = payload;
        }

        const response = await httpClient(config);
        const data = response.data || {};

        if (!data.ok) {
          const slackError = data.error || 'unknown_error';
          if (slackError === 'ratelimited') {
            const retryAfterSec = Number(response.headers?.['retry-after']) || 1;
            const waitMs = Math.min(retryAfterSec * 1000, 3000);
            await new Promise((res) => setTimeout(res, waitMs));
            continue;
          }
          throw new Error(`Slack API error: ${slackError}${data.needed ? ` (needed scope: ${data.needed})` : ''}`);
        }

        return data;
      } catch (err) {
        lastError = err;
        if (err.response?.status === 429) {
          const retryAfterSec = Number(err.response.headers?.['retry-after']) || 1;
          const waitMs = Math.min(retryAfterSec * 1000, 3000);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  async execute(node, context, options = {}) {
    const startedAt = Date.now();
    const data = node?.data || {};

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    // 1. Resolve credentials
    const { connectionId, token: directToken } = data;
    let token = directToken;
    let defaultChannel = '';

    if (connectionId) {
      const ownerId = context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
      try {
        const credentials = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
        token = credentials.token || credentials.botToken || credentials.accessToken;
        defaultChannel = credentials.defaultChannel || '';
      } catch (err) {
        throw new NodeExecutionError(`Failed to retrieve Slack connection: ${err.message}`, {
          nodeId: node.id,
          nodeType: this.type,
          originalError: err,
        });
      }
    }

    if (!token) {
      throw new NodeExecutionError('Slack token could not be resolved from connection or node configuration', {
        nodeId: node.id,
        nodeType: this.type,
      });
    }

    const httpClient = options?._slackClient || context?._slackClient || this._slackClient || axios;
    const operation = this._normalizeOp(data.operation || 'send_message');

    // 2. Resolve variables
    const rawChannel = data.channel || defaultChannel || '';
    const resolvedChannel = resolveVariable(rawChannel, context);
    const rawText = data.text !== undefined ? data.text : (data.message !== undefined ? data.message : '');
    const resolvedText = resolveVariable(rawText, context);
    const resolvedThreadTs = data.threadTs ? resolveVariable(data.threadTs, context) : undefined;
    const resolvedUserId = (data.userId || data.user) ? resolveVariable(data.userId || data.user, context) : undefined;

    let resultPayload = null;

    try {
      switch (operation) {
        case 'send_message': {
          const apiRes = await this._callSlackApi(
            'chat.postMessage',
            {
              channel: resolvedChannel,
              text: resolvedText,
              thread_ts: resolvedThreadTs || undefined,
            },
            token,
            httpClient
          );

          resultPayload = {
            ok: true,
            channel: apiRes.channel || resolvedChannel,
            ts: apiRes.ts,
            messageId: apiRes.ts,
            text: resolvedText,
            message: apiRes.message,
            operation: 'send_message',
          };
          break;
        }

        case 'send_dm': {
          // Step A: open DM conversation channel with user
          const openRes = await this._callSlackApi(
            'conversations.open',
            { users: resolvedUserId },
            token,
            httpClient
          );

          const dmChannel = openRes.channel?.id;
          if (!dmChannel) {
            throw new Error(`Failed to open direct message channel with user "${resolvedUserId}"`);
          }

          // Step B: post message to DM channel
          const msgRes = await this._callSlackApi(
            'chat.postMessage',
            {
              channel: dmChannel,
              text: resolvedText,
              thread_ts: resolvedThreadTs || undefined,
            },
            token,
            httpClient
          );

          resultPayload = {
            ok: true,
            channel: dmChannel,
            dmChannelId: dmChannel,
            userId: resolvedUserId,
            ts: msgRes.ts,
            messageId: msgRes.ts,
            text: resolvedText,
            message: msgRes.message,
            operation: 'send_dm',
          };
          break;
        }

        case 'send_blocks': {
          const resolvedBlocks = this._resolveBlocks(data.blocks, context);
          const apiRes = await this._callSlackApi(
            'chat.postMessage',
            {
              channel: resolvedChannel,
              text: resolvedText || 'Slack notification',
              blocks: Array.isArray(resolvedBlocks) && resolvedBlocks.length > 0 ? resolvedBlocks : undefined,
              thread_ts: resolvedThreadTs || undefined,
            },
            token,
            httpClient
          );

          resultPayload = {
            ok: true,
            channel: apiRes.channel || resolvedChannel,
            ts: apiRes.ts,
            messageId: apiRes.ts,
            text: resolvedText,
            blocksCount: Array.isArray(resolvedBlocks) ? resolvedBlocks.length : 0,
            message: apiRes.message,
            operation: 'send_blocks',
          };
          break;
        }

        case 'get_channel': {
          const targetChannel = resolvedChannel || (data.channelId ? resolveVariable(data.channelId, context) : '');
          const apiRes = await this._callSlackApi(
            'conversations.info',
            { channel: targetChannel },
            token,
            httpClient,
            'GET'
          );

          const ch = apiRes.channel || {};
          resultPayload = {
            ok: true,
            channel: ch,
            channelId: ch.id || targetChannel,
            name: ch.name || '',
            isPrivate: ch.is_private || false,
            memberCount: ch.num_members || 0,
            topic: ch.topic?.value || '',
            purpose: ch.purpose?.value || '',
            operation: 'get_channel',
          };
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported Slack operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      const errMsg = redactSecrets(err.message || 'Unknown Slack error');
      throw new NodeExecutionError(errMsg, {
        nodeId: node.id,
        nodeType: this.type,
        nodeName: node.data?.label,
        originalError: err,
      });
    }

    const durationMs = Date.now() - startedAt;

    return redactSecrets({
      ...resultPayload,
      durationMs,
    });
  }
}

module.exports = SlackNode;

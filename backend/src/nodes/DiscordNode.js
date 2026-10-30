const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable, redactSecrets } = require('../utils');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');
const axios = require('axios');

/**
 * DiscordNode — Discord messaging and channel management node.
 * Supports:
 *   - Send Message (via Bot Token or Webhook)
 *   - Send Embed (rich formatted cards with colors, fields, footers)
 *   - Send Message using Webhook (custom username and avatar support)
 *   - Get Channel Information (via Bot Token)
 */
class DiscordNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_DISCORD,
      name: 'Discord',
      category: 'action',
      icon: 'MessageCircle',
      description: 'Send messages, embeds, and webhook notifications, and retrieve channel details in Discord',
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
    if (['send_message', 'message', 'post_message', 'send_channel_message'].includes(raw)) return 'send_message';
    if (['send_embed', 'embed', 'rich_embed'].includes(raw)) return 'send_embed';
    if (['send_webhook', 'webhook', 'send_message_using_webhook'].includes(raw)) return 'send_webhook';
    if (['get_channel', 'channel_info', 'get_channel_info', 'channel'].includes(raw)) return 'get_channel';
    return raw;
  }

  validate(node) {
    const data = node?.data || {};
    const { connectionId, botToken, token, webhookUrl } = data;
    const operation = this._normalizeOp(data.operation || 'send_message');

    if (!connectionId && !botToken && !token && !webhookUrl) {
      return { valid: false, error: 'Discord connection, Bot Token, or Webhook URL is required' };
    }

    const validOps = ['send_message', 'send_embed', 'send_webhook', 'get_channel'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${data.operation}". Supported: ${validOps.join(', ')}` };
    }

    if (operation === 'send_message') {
      if (!data.content && !data.text && !data.message) {
        return { valid: false, error: 'Message content is required for Send Message' };
      }
    }

    if (operation === 'send_embed') {
      if (!data.embed && !data.embeds && !data.title && !data.description && !data.content) {
        return { valid: false, error: 'Embed data or title/description is required for Send Embed' };
      }
    }

    if (operation === 'send_webhook') {
      if (!webhookUrl && !connectionId) {
        return { valid: false, error: 'Webhook URL or Webhook Connection is required' };
      }
      if (!data.content && !data.embeds && !data.embed) {
        return { valid: false, error: 'Content or embeds required for Send Webhook' };
      }
    }

    if (operation === 'get_channel') {
      if (!data.channelId && !data.channel) {
        return { valid: false, error: 'Channel ID is required for Get Channel Info' };
      }
    }

    return { valid: true };
  }

  /**
   * Parse hex or color string into integer color for Discord embed
   * @param {string|number} color
   * @returns {number|undefined}
   */
  _parseColor(color) {
    if (color === undefined || color === null || color === '') return undefined;
    if (typeof color === 'number' && !isNaN(color)) return color;
    if (typeof color === 'string') {
      const clean = color.trim().replace(/^#/, '');
      const parsed = parseInt(clean, 16);
      return !isNaN(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  /**
   * Resolves dynamic variables in embed objects and arrays
   */
  _resolveEmbed(embedInput, data, context) {
    let base = embedInput;

    if (typeof base === 'string') {
      const resolved = resolveVariable(base, context);
      try {
        base = JSON.parse(resolved);
      } catch {
        base = { description: resolved };
      }
    }

    if (!base || typeof base !== 'object') {
      base = {};
    }

    // Merge individual fields if configured directly in node.data
    const title = base.title !== undefined ? base.title : data.title;
    const description = base.description !== undefined ? base.description : data.description;
    const url = base.url !== undefined ? base.url : data.url;
    const color = base.color !== undefined ? base.color : data.color;
    const footerText = base.footer?.text || data.footerText || (typeof data.footer === 'string' ? data.footer : data.footer?.text);

    const embed = {
      title: title ? resolveVariable(String(title), context) : undefined,
      description: description ? resolveVariable(String(description), context) : undefined,
      url: url ? resolveVariable(String(url), context) : undefined,
      color: this._parseColor(color),
      timestamp: base.timestamp || (data.timestamp ? new Date().toISOString() : undefined),
    };

    if (footerText) {
      embed.footer = { text: resolveVariable(String(footerText), context) };
    }

    // Handle fields array
    const rawFields = base.fields || data.fields;
    if (Array.isArray(rawFields)) {
      embed.fields = rawFields.map((f) => ({
        name: resolveVariable(String(f.name || ''), context),
        value: resolveVariable(String(f.value || ''), context),
        inline: Boolean(f.inline),
      }));
    }

    // Clean undefined keys
    Object.keys(embed).forEach((k) => embed[k] === undefined && delete embed[k]);
    return embed;
  }

  /**
   * Execute Discord API call with rate limit handling (HTTP 429)
   */
  async _callDiscordApi(config, httpClient = axios) {
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await httpClient({
          ...config,
          timeout: 15000,
        });
        return response.data;
      } catch (err) {
        lastError = err;
        if (err.response?.status === 429) {
          const retryAfter = Number(err.response.data?.retry_after) ||
            Number(err.response.headers?.['retry-after']) ||
            Number(err.response.headers?.['x-ratelimit-reset-after']) || 0.5;
          const waitMs = Math.min(retryAfter * 1000, 3000);
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

    // 1. Resolve credentials & connection
    const { connectionId, botToken: directBotToken, token: directToken, webhookUrl: directWebhookUrl } = data;
    let botToken = directBotToken || directToken;
    let webhookUrl = directWebhookUrl;
    let connectionType = webhookUrl ? 'webhook' : 'bot_token';

    if (connectionId) {
      const ownerId = context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
      try {
        const credentials = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
        connectionType = credentials.authType || (credentials.webhookUrl ? 'webhook' : 'bot_token');
        if (credentials.botToken || credentials.token) botToken = credentials.botToken || credentials.token;
        if (credentials.webhookUrl) webhookUrl = credentials.webhookUrl;
      } catch (err) {
        throw new NodeExecutionError(`Failed to retrieve Discord connection: ${err.message}`, {
          nodeId: node.id,
          nodeType: this.type,
          originalError: err,
        });
      }
    }

    const httpClient = options?._discordClient || context?._discordClient || this._discordClient || axios;
    const operation = this._normalizeOp(data.operation || 'send_message');

    // 2. Resolve parameters & variables
    const rawContent = data.content !== undefined ? data.content : (data.text !== undefined ? data.text : (data.message !== undefined ? data.message : ''));
    const resolvedContent = rawContent ? resolveVariable(String(rawContent), context) : '';
    const rawChannelId = data.channelId || data.channel || '';
    const resolvedChannelId = rawChannelId ? resolveVariable(String(rawChannelId), context) : '';
    const resolvedWebhookUrl = webhookUrl ? resolveVariable(String(webhookUrl), context) : '';

    let resultPayload = null;

    try {
      switch (operation) {
        case 'send_message': {
          // If webhookUrl is available, dispatch via webhook; otherwise via bot channel messages
          if (connectionType === 'webhook' || (resolvedWebhookUrl && !resolvedChannelId)) {
            if (!resolvedWebhookUrl) {
              throw new Error('Discord Webhook URL is required');
            }
            const apiRes = await this._callDiscordApi({
              method: 'POST',
              url: `${resolvedWebhookUrl}${resolvedWebhookUrl.includes('?') ? '&' : '?'}wait=true`,
              data: {
                content: resolvedContent,
              },
            }, httpClient);

            resultPayload = {
              ok: true,
              id: apiRes?.id,
              messageId: apiRes?.id,
              channelId: apiRes?.channel_id,
              content: resolvedContent,
              operation: 'send_message',
              deliveryMethod: 'webhook',
            };
          } else {
            if (!botToken) throw new Error('Discord Bot Token is required to send to a channel ID');
            if (!resolvedChannelId) throw new Error('Channel ID is required for Discord Bot message');

            const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');
            const apiRes = await this._callDiscordApi({
              method: 'POST',
              url: `https://discord.com/api/v10/channels/${resolvedChannelId}/messages`,
              headers: {
                Authorization: `Bot ${cleanToken}`,
                'Content-Type': 'application/json',
              },
              data: {
                content: resolvedContent,
              },
            }, httpClient);

            resultPayload = {
              ok: true,
              id: apiRes?.id,
              messageId: apiRes?.id,
              channelId: apiRes?.channel_id || resolvedChannelId,
              content: resolvedContent,
              operation: 'send_message',
              deliveryMethod: 'bot',
            };
          }
          break;
        }

        case 'send_embed': {
          const embedObj = this._resolveEmbed(data.embed, data, context);
          const embedsArray = data.embeds && Array.isArray(data.embeds)
            ? data.embeds.map((e) => this._resolveEmbed(e, {}, context))
            : [embedObj];

          if (connectionType === 'webhook' || (resolvedWebhookUrl && !resolvedChannelId)) {
            if (!resolvedWebhookUrl) throw new Error('Discord Webhook URL is required for embed');

            const apiRes = await this._callDiscordApi({
              method: 'POST',
              url: `${resolvedWebhookUrl}${resolvedWebhookUrl.includes('?') ? '&' : '?'}wait=true`,
              data: {
                content: resolvedContent || undefined,
                embeds: embedsArray,
              },
            }, httpClient);

            resultPayload = {
              ok: true,
              id: apiRes?.id,
              messageId: apiRes?.id,
              channelId: apiRes?.channel_id,
              embedsCount: embedsArray.length,
              operation: 'send_embed',
              deliveryMethod: 'webhook',
            };
          } else {
            if (!botToken) throw new Error('Discord Bot Token is required for embed message');
            if (!resolvedChannelId) throw new Error('Channel ID is required for Discord Bot embed message');

            const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');
            const apiRes = await this._callDiscordApi({
              method: 'POST',
              url: `https://discord.com/api/v10/channels/${resolvedChannelId}/messages`,
              headers: {
                Authorization: `Bot ${cleanToken}`,
                'Content-Type': 'application/json',
              },
              data: {
                content: resolvedContent || undefined,
                embeds: embedsArray,
              },
            }, httpClient);

            resultPayload = {
              ok: true,
              id: apiRes?.id,
              messageId: apiRes?.id,
              channelId: apiRes?.channel_id || resolvedChannelId,
              embedsCount: embedsArray.length,
              operation: 'send_embed',
              deliveryMethod: 'bot',
            };
          }
          break;
        }

        case 'send_webhook': {
          if (!resolvedWebhookUrl) {
            throw new Error('Discord Webhook URL is required for send_webhook');
          }

          const username = data.username ? resolveVariable(String(data.username), context) : undefined;
          const avatarUrl = data.avatarUrl ? resolveVariable(String(data.avatarUrl), context) : undefined;
          const embeds = data.embeds
            ? (Array.isArray(data.embeds) ? data.embeds.map((e) => this._resolveEmbed(e, {}, context)) : [this._resolveEmbed(data.embeds, {}, context)])
            : (data.embed ? [this._resolveEmbed(data.embed, data, context)] : undefined);

          const apiRes = await this._callDiscordApi({
            method: 'POST',
            url: `${resolvedWebhookUrl}${resolvedWebhookUrl.includes('?') ? '&' : '?'}wait=true`,
            data: {
              content: resolvedContent || undefined,
              username,
              avatar_url: avatarUrl,
              embeds,
            },
          }, httpClient);

          resultPayload = {
            ok: true,
            id: apiRes?.id,
            messageId: apiRes?.id,
            channelId: apiRes?.channel_id,
            content: resolvedContent,
            username: username || apiRes?.author?.username,
            operation: 'send_webhook',
            deliveryMethod: 'webhook',
          };
          break;
        }

        case 'get_channel': {
          if (!botToken) {
            throw new Error('Getting Discord channel info requires a Discord Bot Token connection');
          }
          if (!resolvedChannelId) {
            throw new Error('Channel ID is required to retrieve channel info');
          }

          const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');
          const apiRes = await this._callDiscordApi({
            method: 'GET',
            url: `https://discord.com/api/v10/channels/${resolvedChannelId}`,
            headers: {
              Authorization: `Bot ${cleanToken}`,
            },
          }, httpClient);

          resultPayload = {
            ok: true,
            channel: apiRes,
            id: apiRes?.id,
            name: apiRes?.name,
            type: apiRes?.type,
            guildId: apiRes?.guild_id,
            topic: apiRes?.topic || '',
            operation: 'get_channel',
          };
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported Discord operation: "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      let userFriendlyMsg = err.message;

      if (status === 401) {
        userFriendlyMsg = 'Discord Authentication failed: Invalid Bot Token or Webhook URL';
      } else if (status === 403) {
        userFriendlyMsg = `Discord Permission denied: Bot lacks required channel permissions (${responseData?.message || 'Missing Access'})`;
      } else if (status === 404) {
        userFriendlyMsg = resolvedWebhookUrl
          ? `Discord Resource not found: Verify Webhook URL ${resolvedWebhookUrl}`
          : `Discord Resource not found: Verify channel ID "${resolvedChannelId}"`;
      } else if (responseData?.message) {
        userFriendlyMsg = `Discord API error: ${responseData.message}`;
      }

      throw new NodeExecutionError(redactSecrets(userFriendlyMsg), {
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

module.exports = DiscordNode;

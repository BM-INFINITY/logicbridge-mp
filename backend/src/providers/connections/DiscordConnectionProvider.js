const ConnectionProvider = require('./ConnectionProvider');
const axios = require('axios');

/**
 * DiscordConnectionProvider — manages Discord Bot Token and Incoming Webhook connections.
 * Supports verifying token validity via Discord REST API v10.
 */
class DiscordConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'discord',
      name: 'Discord',
      icon: 'MessageCircle',
      category: 'chat',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        {
          key: 'authType',
          label: 'Connection Type',
          type: 'select',
          required: true,
          options: ['bot_token', 'webhook'],
          placeholder: 'Choose Bot Token or Webhook',
          helperText: 'Select Bot Token for channel management and DMs, or Webhook for simple channel alerts',
        },
        {
          key: 'botToken',
          label: 'Bot Token',
          type: 'password',
          required: false,
          placeholder: 'MTA... Discord Bot Token',
          helperText: 'Required if Connection Type is Bot Token (from Discord Developer Portal)',
        },
        {
          key: 'webhookUrl',
          label: 'Webhook URL',
          type: 'password',
          required: false,
          placeholder: 'https://discord.com/api/webhooks/123456789/abcdef...',
          helperText: 'Required if Connection Type is Webhook',
        },
        {
          key: 'guildName',
          label: 'Server / Guild Name (optional)',
          type: 'text',
          required: false,
          placeholder: 'My Discord Server',
        },
      ],
    });
  }

  /**
   * Verify Discord credentials via Discord REST API v10
   * @param {object} credentials
   * @returns {Promise<{ ok: boolean, message: string, bot?: string, webhookName?: string }>}
   */
  async verify(credentials = {}) {
    const authType = credentials.authType || (credentials.webhookUrl ? 'webhook' : 'bot_token');

    // Support test mock injection
    if (credentials._mockAuthResult) {
      if (credentials._mockAuthResult instanceof Error) {
        return {
          ok: false,
          message: `Discord verification error: ${credentials._mockAuthResult.message}`,
        };
      }
      return credentials._mockAuthResult;
    }

    const httpClient = credentials._axiosClient || axios;

    if (authType === 'webhook') {
      const webhookUrl = credentials.webhookUrl;
      if (!webhookUrl || !String(webhookUrl).trim()) {
        return { ok: false, message: 'Discord Webhook URL is required' };
      }

      const trimmed = String(webhookUrl).trim();
      const isDiscordWebhook = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/i.test(trimmed) ||
        trimmed.startsWith('mock-') || trimmed.includes('localhost');

      if (!isDiscordWebhook) {
        return { ok: false, message: 'Invalid Discord Webhook URL format. Must start with https://discord.com/api/webhooks/' };
      }

      try {
        const response = await httpClient({
          method: 'GET',
          url: trimmed,
          timeout: 10000,
        });

        const data = response.data || {};
        return {
          ok: true,
          message: `Connected to Discord webhook "${data.name || 'Webhook'}" (Channel ID: ${data.channel_id || 'unknown'})`,
          webhookName: data.name || 'Webhook',
          channelId: data.channel_id,
          guildId: data.guild_id,
        };
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.message;
        if (status === 404 || status === 401) {
          return { ok: false, message: 'Discord Webhook not found or token revoked' };
        }
        return { ok: false, message: `Discord Webhook verification failed: ${msg}` };
      }
    }

    // Bot Token Flow
    const botToken = credentials.botToken || credentials.token;
    if (!botToken || !String(botToken).trim()) {
      return { ok: false, message: 'Discord Bot Token is required' };
    }

    const trimmedToken = String(botToken).trim().replace(/^Bot\s+/i, '');

    try {
      const response = await httpClient({
        method: 'GET',
        url: 'https://discord.com/api/v10/users/@me',
        headers: {
          Authorization: `Bot ${trimmedToken}`,
        },
        timeout: 10000,
      });

      const data = response.data || {};
      const tag = data.discriminator && data.discriminator !== '0'
        ? `${data.username}#${data.discriminator}`
        : `@${data.username}`;

      return {
        ok: true,
        message: `Connected as Discord bot ${tag} (ID: ${data.id})`,
        bot: tag,
        botTag: tag,
        username: data.username,
        botId: data.id,
        userId: data.id,
        discriminator: data.discriminator,
      };
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      if (status === 401) {
        return { ok: false, message: 'Invalid Discord Bot Token. Check credentials in Discord Developer Portal.' };
      }
      return { ok: false, message: `Discord Bot verification failed: ${msg}` };
    }
  }

  /**
   * Connect to Discord: verify credentials and return metadata for storage
   */
  async connect(credentials = {}) {
    const result = await this.verify(credentials);
    if (!result.ok) {
      const err = new Error(result.message);
      err.statusCode = 400;
      throw err;
    }

    const authType = credentials.authType || (credentials.webhookUrl ? 'webhook' : 'bot_token');

    return {
      success: true,
      email: result.bot || result.webhookName || '',
      metadata: {
        authType,
        bot: result.bot,
        botId: result.botId,
        webhookName: result.webhookName,
        channelId: result.channelId,
        guildId: result.guildId,
        guildName: credentials.guildName || '',
      },
    };
  }

  async verifyCredentials(credentials) {
    return this.verify(credentials);
  }

  async disconnect() {
    return { success: true };
  }
}

module.exports = DiscordConnectionProvider;

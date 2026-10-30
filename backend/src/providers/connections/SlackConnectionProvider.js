const ConnectionProvider = require('./ConnectionProvider');
const axios = require('axios');

/**
 * SlackConnectionProvider — manages Slack Workspace Bot User OAuth Token connections.
 * Supports verifying token validity via Slack's auth.test endpoint.
 */
class SlackConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'slack',
      name: 'Slack',
      icon: 'MessageSquare',
      category: 'chat',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        {
          key: 'token',
          label: 'Bot User OAuth Token',
          type: 'password',
          required: true,
          placeholder: 'xoxb-your-token-here',
          helperText: 'Must begin with xoxb- or xoxp- from your Slack App configuration',
        },
        {
          key: 'defaultChannel',
          label: 'Default Channel (optional)',
          type: 'text',
          required: false,
          placeholder: '#general or C0123456789',
          helperText: 'Default destination channel if omitted in workflow node',
        },
      ],
    });
  }

  /**
   * Verify Slack credentials using the auth.test Web API endpoint
   * @param {object} credentials
   * @returns {Promise<{ ok: boolean, message: string, team?: string, user?: string }>}
   */
  async verify(credentials = {}) {
    const token = credentials.token || credentials.botToken || credentials.accessToken;

    if (!token || !String(token).trim()) {
      return { ok: false, message: 'Slack token is required' };
    }

    const trimmed = String(token).trim();
    if (!trimmed.startsWith('xoxb-') && !trimmed.startsWith('xoxp-') && !trimmed.startsWith('mock-')) {
      return {
        ok: false,
        message: 'Invalid Slack token format. Bot tokens must begin with "xoxb-" or "xoxp-".',
      };
    }

    // Support test mock injection
    if (credentials._mockAuthResult) {
      if (credentials._mockAuthResult instanceof Error) {
        return {
          ok: false,
          message: `Slack verification error: ${credentials._mockAuthResult.message}`,
        };
      }
      const data = credentials._mockAuthResult;
      if (data.ok) {
        return {
          ok: true,
          message: `Connected to Slack workspace "${data.team || 'Mock'}" as @${data.user || 'bot'}`,
          team: data.team,
          teamId: data.team_id,
          user: data.user,
          userId: data.user_id,
          botId: data.bot_id,
          bot_id: data.bot_id,
          url: data.url,
        };
      }
      return {
        ok: false,
        message: `Slack authentication failed: ${data.error || 'Invalid credentials'}`,
      };
    }

    const httpClient = credentials._axiosClient || axios;

    try {
      const response = await httpClient({
        method: 'POST',
        url: 'https://slack.com/api/auth.test',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        timeout: 10000,
      });

      const data = response.data || {};
      if (data.ok) {
        return {
          ok: true,
          message: `Connected to Slack workspace "${data.team}" as @${data.user}`,
          team: data.team,
          teamId: data.team_id,
          user: data.user,
          userId: data.user_id,
          botId: data.bot_id,
          bot_id: data.bot_id,
          url: data.url,
        };
      }

      return {
        ok: false,
        message: `Slack authentication failed: ${data.error || 'Invalid credentials'}`,
      };
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Network error reaching Slack API';
      return {
        ok: false,
        message: `Slack verification error: ${errMsg}`,
      };
    }
  }

  /**
   * Connect to Slack: verify credentials and return metadata for storage
   */
  async connect(credentials = {}) {
    const result = await this.verify(credentials);
    if (!result.ok) {
      const err = new Error(result.message);
      err.statusCode = 400;
      throw err;
    }

    return {
      success: true,
      email: result.user || '',
      metadata: {
        team: result.team,
        teamId: result.teamId,
        user: result.user,
        userId: result.userId,
        botId: result.botId,
        url: result.url,
        defaultChannel: credentials.defaultChannel || '',
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

module.exports = SlackConnectionProvider;

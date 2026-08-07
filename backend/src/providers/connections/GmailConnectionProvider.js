const { google } = require('googleapis');
const ConnectionProvider = require('./ConnectionProvider');
const OAuthService = require('../../services/OAuthService');

/**
 * GmailConnectionProvider — production Gmail OAuth provider.
 *
 * Uses Google OAuth 2.0 tokens to send emails via the Gmail API.
 * Token refresh is automatic — users never need to reconnect manually
 * unless their refresh token is explicitly revoked.
 */
class GmailConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'gmail',
      name: 'Google Gmail',
      icon: '📩',
      category: 'email',
      supportsVerification: true,
      supportsOAuth: true,
      supportsRefresh: true,
      supportsEmail: true,
      supportsAttachments: false,
      supportsHTML: true,
      supportsTemplates: true,
      requiredFields: [], // OAuth — credentials come from Google consent screen
    });
  }

  /**
   * Called after token exchange completes.
   * Credentials are already validated by OAuthService.exchangeCode().
   * @param {object} credentials - { accessToken, refreshToken, expiryDate, email }
   */
  async connect(credentials) {
    return {
      success: true,
      email: credentials.email,
      metadata: { name: credentials.name, picture: credentials.picture },
    };
  }

  /**
   * Verify Gmail credentials by calling userinfo endpoint.
   */
  async verify(credentials) {
    return OAuthService.verifyCredentials(credentials);
  }

  /**
   * Disconnect: revoke token and clean up.
   */
  async disconnect(credentials) {
    if (credentials?.accessToken) {
      await OAuthService.revokeToken(credentials.accessToken);
    }
    return { success: true };
  }

  /**
   * Refresh access token using stored refresh token.
   */
  async refresh(credentials) {
    return OAuthService.refreshAccessToken(credentials);
  }

  /**
   * Send an email via the Gmail API.
   *
   * @param {object} credentials - decrypted credentials
   * @param {object} mailOptions - { to, cc, bcc, subject, text, html }
   * @returns {object} standardized delivery result
   */
  async sendEmail(credentials, mailOptions) {
    const { client, credentials: updatedCreds, wasRefreshed } =
      await OAuthService.buildAuthenticatedClient(credentials);

    const gmail = google.gmail({ version: 'v1', auth: client });

    // Build RFC 2822 email message
    const raw = GmailConnectionProvider._buildRawMessage({
      from: `${updatedCreds.name || updatedCreds.email} <${updatedCreds.email}>`,
      ...mailOptions,
    });

    let gmailResponse;
    try {
      gmailResponse = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
    } catch (err) {
      const apiErr = err.response?.data?.error;
      if (apiErr?.code === 429) {
        throw new Error('Gmail quota exceeded — too many emails sent. Try again later.');
      }
      if (apiErr?.code === 401 || apiErr?.status === 'UNAUTHENTICATED') {
        throw new Error('Gmail authorization revoked. Please reconnect your Gmail account in Connections.');
      }
      throw new Error(apiErr?.message || err.message || 'Gmail API error during send');
    }

    return {
      accepted: [mailOptions.to],
      rejected: [],
      messageId: gmailResponse.data.id,
      threadId: gmailResponse.data.threadId,
      provider: 'gmail',
      delivered: true,
      sentAt: new Date().toISOString(),
      // Return updated credentials so caller can persist new tokens if refreshed
      _updatedCredentials: wasRefreshed ? updatedCreds : null,
    };
  }

  /**
   * Build a base64url-encoded RFC 2822 MIME message.
   * @private
   */
  static _buildRawMessage({ from, to, cc, bcc, subject, text, html }) {
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
    ];
    if (cc) lines.push(`Cc: ${cc}`);
    if (bcc) lines.push(`Bcc: ${bcc}`);
    lines.push(`Subject: ${subject || '(no subject)'}`);
    lines.push('MIME-Version: 1.0');

    if (html) {
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('');
      lines.push(html);
    } else {
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('');
      lines.push(text || '');
    }

    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }
}

module.exports = GmailConnectionProvider;

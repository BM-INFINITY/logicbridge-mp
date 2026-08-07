const nodemailer = require('nodemailer');
const ConnectionProvider = require('./ConnectionProvider');

/**
 * SMTPConnectionProvider — user-owned SMTP account integration.
 *
 * Users supply their own SMTP credentials (host, port, user, password).
 * No shared platform credentials are used.
 */
class SMTPConnectionProvider extends ConnectionProvider {
  constructor() {
    super({
      id: 'smtp',
      name: 'SMTP / Email',
      icon: '📧',
      category: 'email',
      supportsVerification: true,
      supportsOAuth: false,
      supportsRefresh: false,
      requiredFields: [
        { key: 'host',     label: 'SMTP Host',     type: 'text',     placeholder: 'smtp.gmail.com',  required: true },
        { key: 'port',     label: 'Port',          type: 'number',   placeholder: '587',             required: true },
        { key: 'secure',   label: 'Use SSL/TLS',   type: 'checkbox', placeholder: '',                required: false },
        { key: 'user',     label: 'Username',      type: 'text',     placeholder: 'you@example.com', required: true },
        { key: 'password', label: 'Password',      type: 'password', placeholder: '••••••••',        required: true },
        { key: 'from',     label: 'From Address',  type: 'text',     placeholder: 'You <you@example.com>', required: false },
      ],
    });
  }

  _buildTransporter(credentials) {
    return nodemailer.createTransport({
      host: credentials.host,
      port: parseInt(credentials.port || '587', 10),
      secure: credentials.secure === true || credentials.secure === 'true',
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 10_000,
    });
  }

  async connect(credentials) {
    const transporter = this._buildTransporter(credentials);
    try {
      await transporter.verify();
      return {
        success: true,
        email: credentials.user,
        metadata: { host: credentials.host, port: credentials.port },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async verify(credentials) {
    const transporter = this._buildTransporter(credentials);
    try {
      await transporter.verify();
      return { ok: true, message: `SMTP connection to ${credentials.host} verified` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  async disconnect(_credentials) {
    // SMTP is stateless — nothing to clean up
    return { success: true };
  }

  async refresh(credentials) {
    // SMTP credentials don't expire; return unchanged
    return credentials;
  }

  /**
   * Send email via user-owned SMTP credentials.
   * Interface matches GmailConnectionProvider.sendEmail() so EmailNode can call
   * either provider without knowing which one it's using.
   */
  async sendEmail(credentials, mailOptions) {
    const transporter = this._buildTransporter(credentials);
    const from = credentials.from || credentials.user;

    let info;
    try {
      info = await transporter.sendMail({ from, ...mailOptions });
    } catch (err) {
      throw new Error(err.message || 'SMTP send failed');
    }

    return {
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope,
      provider: 'smtp',
      delivered: (info.accepted || []).length > 0,
      sentAt: new Date().toISOString(),
    };
  }
}

module.exports = SMTPConnectionProvider;

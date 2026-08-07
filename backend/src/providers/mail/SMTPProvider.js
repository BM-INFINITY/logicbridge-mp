const nodemailer = require('nodemailer');
const MailProvider = require('./MailProvider');
const NodeExecutionError = require('../../errors/NodeExecutionError');

/**
 * SMTPProvider — production mail delivery via Nodemailer.
 *
 * Reads configuration from environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 */
class SMTPProvider extends MailProvider {
  constructor() {
    super();

    this._host = process.env.SMTP_HOST;
    this._port = parseInt(process.env.SMTP_PORT || '587', 10);
    this._secure = process.env.SMTP_SECURE === 'true';
    this._user = process.env.SMTP_USER;
    this._password = process.env.SMTP_PASSWORD;
    this._from = process.env.SMTP_FROM || this._user;

    this._transporter = null;
  }

  /**
   * Returns true only if all required env vars are set.
   */
  isConfigured() {
    return Boolean(this._host && this._user && this._password);
  }

  /**
   * Lazily initialize nodemailer transporter.
   */
  _getTransporter() {
    if (!this._transporter) {
      if (!this.isConfigured()) {
        throw new NodeExecutionError(
          'SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.',
          { nodeType: 'action-email' }
        );
      }

      this._transporter = nodemailer.createTransport({
        host: this._host,
        port: this._port,
        secure: this._secure,
        auth: {
          user: this._user,
          pass: this._password,
        },
        // Reasonable timeouts so execution does not hang indefinitely
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }

    return this._transporter;
  }

  /**
   * Send email and return standardized delivery result.
   *
   * @param {object} options
   * @param {string}  options.to
   * @param {string}  [options.cc]
   * @param {string}  [options.bcc]
   * @param {string}  options.subject
   * @param {string}  [options.text]
   * @param {string}  [options.html]
   * @returns {Promise<object>}
   */
  async send({ to, cc, bcc, subject, text, html }) {
    const transporter = this._getTransporter();

    const mailOptions = {
      from: this._from,
      to,
      subject,
    };

    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    // Prefer html; fall back to text; then plain body param
    if (html) {
      mailOptions.html = html;
      if (text) mailOptions.text = text;
    } else if (text) {
      mailOptions.text = text;
    }

    let info;
    try {
      info = await transporter.sendMail(mailOptions);
    } catch (err) {
      // Map nodemailer errors to descriptive NodeExecutionErrors
      const msg = SMTPProvider._describeError(err);
      throw new NodeExecutionError(msg, {
        nodeType: 'action-email',
        originalError: err,
      });
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

  /**
   * Verify SMTP transporter connectivity.
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async verifyConnection() {
    if (!this.isConfigured()) {
      return { ok: false, message: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD' };
    }

    try {
      const transporter = this._getTransporter();
      await transporter.verify();
      return { ok: true, message: `SMTP connected to ${this._host}:${this._port}` };
    } catch (err) {
      return { ok: false, message: SMTPProvider._describeError(err) };
    }
  }

  /**
   * Translate raw nodemailer / net errors into user-readable messages.
   * @private
   */
  static _describeError(err) {
    const code = err.code || '';
    const responseCode = err.responseCode || 0;

    if (code === 'EAUTH' || responseCode === 535) {
      return 'SMTP authentication failed — check SMTP_USER and SMTP_PASSWORD';
    }
    if (code === 'ECONNREFUSED') {
      return `SMTP connection refused — check SMTP_HOST (${process.env.SMTP_HOST}) and SMTP_PORT`;
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
      return 'SMTP connection timed out — host unreachable or firewall blocking port';
    }
    if (responseCode >= 550 && responseCode < 560) {
      return `Recipient rejected by SMTP server (${responseCode}) — check the "to" address`;
    }
    if (code === 'EENVELOPE') {
      return `Invalid envelope address — ${err.message}`;
    }

    return err.message || 'Unknown SMTP error during mail delivery';
  }
}

module.exports = SMTPProvider;

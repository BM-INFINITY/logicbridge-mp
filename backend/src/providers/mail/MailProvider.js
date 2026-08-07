/**
 * MailProvider — abstract base class defining the mail delivery interface.
 *
 * All concrete mail providers (SMTP, SendGrid, Resend, SES, etc.) must
 * extend this class and implement:
 *   - send(options)
 *   - verifyConnection()
 */
class MailProvider {
  /**
   * Send an email message.
   *
   * @param {object} options
   * @param {string}   options.to        - Recipient email address(es), comma-separated or array
   * @param {string}   [options.cc]      - CC address(es)
   * @param {string}   [options.bcc]     - BCC address(es)
   * @param {string}   options.subject   - Email subject
   * @param {string}   [options.text]    - Plain-text body
   * @param {string}   [options.html]    - HTML body
   * @returns {Promise<object>}          - Standardized delivery result
   */
  // eslint-disable-next-line no-unused-vars
  async send(_options) {
    throw new Error(`${this.constructor.name} must implement send()`);
  }

  /**
   * Verify connectivity to the mail provider.
   *
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async verifyConnection() {
    throw new Error(`${this.constructor.name} must implement verifyConnection()`);
  }
}

module.exports = MailProvider;

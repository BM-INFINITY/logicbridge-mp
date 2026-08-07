/**
 * ConnectionProvider — abstract base class for all connection providers.
 *
 * Every concrete provider (SMTPConnectionProvider, GmailProvider, etc.)
 * must extend this class and implement all methods.
 *
 * Design mirrors the Node Registry's BaseNode pattern.
 */
class ConnectionProvider {
  constructor({ id, name, icon, category, supportsVerification, supportsOAuth, supportsRefresh, supportsEmail, supportsAttachments, supportsHTML, supportsTemplates, requiredFields }) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.category = category;
    this.supportsVerification = supportsVerification ?? false;
    this.supportsOAuth = supportsOAuth ?? false;
    this.supportsRefresh = supportsRefresh ?? false;
    this.supportsEmail = supportsEmail ?? false;
    this.supportsAttachments = supportsAttachments ?? false;
    this.supportsHTML = supportsHTML ?? false;
    this.supportsTemplates = supportsTemplates ?? false;
    this.requiredFields = requiredFields || [];
  }

  /**
   * Returns provider metadata object used to drive the Connections UI.
   */
  metadata() {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      category: this.category,
      supportsVerification: this.supportsVerification,
      supportsOAuth: this.supportsOAuth,
      supportsRefresh: this.supportsRefresh,
      supportsEmail: this.supportsEmail,
      supportsAttachments: this.supportsAttachments,
      supportsHTML: this.supportsHTML,
      supportsTemplates: this.supportsTemplates,
      requiredFields: this.requiredFields,
    };
  }

  /**
   * Establish connection using provided credentials.
   * @param {object} credentials - Decrypted credentials payload
   * @returns {Promise<{ success: boolean, email?: string, metadata?: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async connect(_credentials) {
    throw new Error(`${this.constructor.name} must implement connect()`);
  }

  /**
   * Verify that a stored connection is still valid.
   * @param {object} credentials - Decrypted credentials payload
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async verify(_credentials) {
    throw new Error(`${this.constructor.name} must implement verify()`);
  }

  /**
   * Disconnect and clean up tokens.
   * @param {object} credentials - Decrypted credentials payload
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async disconnect(_credentials) {
    throw new Error(`${this.constructor.name} must implement disconnect()`);
  }

  /**
   * Refresh expired credentials (OAuth tokens, etc.).
   * @param {object} credentials - Decrypted credentials payload
   * @returns {Promise<object>} Updated credentials payload
   */
  // eslint-disable-next-line no-unused-vars
  async refresh(_credentials) {
    throw new Error(`${this.constructor.name} must implement refresh()`);
  }
}

module.exports = ConnectionProvider;

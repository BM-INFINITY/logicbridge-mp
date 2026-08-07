/**
 * Mail providers index.
 *
 * Exports:
 *  - MailProvider  : abstract base class (for future provider implementations)
 *  - SMTPProvider  : Nodemailer SMTP concrete implementation
 *  - mailProvider  : singleton instance used across the application
 */
const MailProvider = require('./MailProvider');
const SMTPProvider = require('./SMTPProvider');

// Singleton instance — resolved at startup, shared across all EmailNode executions
const mailProvider = new SMTPProvider();

module.exports = {
  MailProvider,
  SMTPProvider,
  mailProvider,
};

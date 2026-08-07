const ConnectionProvider = require('./ConnectionProvider');
const ConnectionRegistry = require('./ConnectionRegistry');
const SMTPConnectionProvider = require('./SMTPConnectionProvider');
const GmailConnectionProvider = require('./GmailConnectionProvider');

const { connectionRegistry } = ConnectionRegistry;

module.exports = {
  ConnectionProvider,
  ConnectionRegistry: ConnectionRegistry.ConnectionRegistry,
  connectionRegistry,
  SMTPConnectionProvider,
  GmailConnectionProvider,
};

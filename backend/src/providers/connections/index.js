const ConnectionProvider = require('./ConnectionProvider');
const ConnectionRegistry = require('./ConnectionRegistry');
const SMTPConnectionProvider = require('./SMTPConnectionProvider');
const GmailConnectionProvider = require('./GmailConnectionProvider');
const HttpConnectionProvider = require('./HttpConnectionProvider');
const PostgreSQLConnectionProvider = require('./PostgreSQLConnectionProvider');
const MongoDBConnectionProvider = require('./MongoDBConnectionProvider');

const { connectionRegistry } = ConnectionRegistry;

module.exports = {
  ConnectionProvider,
  ConnectionRegistry: ConnectionRegistry.ConnectionRegistry,
  connectionRegistry,
  SMTPConnectionProvider,
  GmailConnectionProvider,
  HttpConnectionProvider,
  PostgreSQLConnectionProvider,
  MongoDBConnectionProvider,
};

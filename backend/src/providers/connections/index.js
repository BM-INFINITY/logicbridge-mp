const ConnectionProvider = require('./ConnectionProvider');
const ConnectionRegistry = require('./ConnectionRegistry');
const SMTPConnectionProvider = require('./SMTPConnectionProvider');
const GmailConnectionProvider = require('./GmailConnectionProvider');
const HttpConnectionProvider = require('./HttpConnectionProvider');
const PostgreSQLConnectionProvider = require('./PostgreSQLConnectionProvider');
const MongoDBConnectionProvider = require('./MongoDBConnectionProvider');
const GoogleSheetsConnectionProvider = require('./GoogleSheetsConnectionProvider');
const SlackConnectionProvider = require('./SlackConnectionProvider');
const DiscordConnectionProvider = require('./DiscordConnectionProvider');
const S3ConnectionProvider = require('./S3ConnectionProvider');

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
  GoogleSheetsConnectionProvider,
  SlackConnectionProvider,
  DiscordConnectionProvider,
  S3ConnectionProvider,
};

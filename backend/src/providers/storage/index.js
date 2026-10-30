const StorageProvider = require('./StorageProvider');
const LocalStorageProvider = require('./LocalStorageProvider');
const S3StorageProvider = require('./S3StorageProvider');
const { StorageRegistry, storageRegistry } = require('./StorageRegistry');

module.exports = {
  StorageProvider,
  LocalStorageProvider,
  S3StorageProvider,
  StorageRegistry,
  storageRegistry,
};


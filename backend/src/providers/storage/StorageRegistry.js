/**
 * StorageRegistry — Registry for managing and resolving storage providers.
 */

const LocalStorageProvider = require('./LocalStorageProvider');
const S3StorageProvider = require('./S3StorageProvider');

class StorageRegistry {
  constructor() {
    this._providers = new Map();
    this._defaultLocalProvider = new LocalStorageProvider();
    this.register('local', this._defaultLocalProvider);
  }

  /**
   * Registers a storage provider instance
   * @param {string} id
   * @param {StorageProvider} providerInstance
   */
  register(id, providerInstance) {
    this._providers.set(String(id).toLowerCase(), providerInstance);
  }

  /**
   * Resolves a storage provider instance by key.
   * For S3, accepts credentials to dynamically configure an S3StorageProvider.
   *
   * @param {string} providerId - 'local' | 'aws_s3' | 's3'
   * @param {object} [credentials] - Connection or direct credentials for S3
   * @returns {StorageProvider}
   */
  resolve(providerId = 'local', credentials = {}) {
    const key = String(providerId || 'local').toLowerCase().trim();

    if (key === 'local') {
      return this._defaultLocalProvider;
    }

    if (key === 'aws_s3' || key === 's3') {
      return new S3StorageProvider(credentials);
    }

    if (this._providers.has(key)) {
      return this._providers.get(key);
    }

    throw new Error(`Unsupported storage provider "${providerId}". Supported providers: local, aws_s3`);
  }

  /**
   * Returns list of supported storage provider names
   * @returns {Array<string>}
   */
  listSupported() {
    return ['local', 'aws_s3'];
  }
}

const storageRegistry = new StorageRegistry();

module.exports = {
  StorageRegistry,
  storageRegistry,
  LocalStorageProvider,
  S3StorageProvider,
};


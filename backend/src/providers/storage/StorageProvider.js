/**
 * StorageProvider — Abstract base class for storage engines in LogicBridge.
 * Defines standard operations: upload, download, list, delete, and getMetadata.
 */

class StorageProvider {
  /**
   * @param {object} config
   * @param {string} config.id - Provider unique ID ('local', 'aws_s3', etc.)
   * @param {string} config.name - Display name
   */
  constructor(config = {}) {
    this.id = config.id || 'storage';
    this.name = config.name || 'Storage Provider';
  }

  /**
   * Upload file content to storage
   * @param {object} params
   * @param {string} params.key - Destination key / path
   * @param {Buffer|string} params.content - File content or buffer
   * @param {string} [params.contentType] - MIME content type
   * @param {object} [params.metadata] - Optional custom metadata
   * @returns {Promise<object>} Upload result
   */
  async upload(_params) {
    throw new Error(`upload() is not implemented for ${this.name}`);
  }

  /**
   * Download file content from storage
   * @param {object} params
   * @param {string} params.key - Source key / path
   * @param {string} [params.format] - Target format ('text', 'json', 'csv', 'binary')
   * @param {string} [params.encoding] - Target encoding ('utf8', 'base64')
   * @returns {Promise<object>} Standard file reference with content
   */
  async download(_params) {
    throw new Error(`download() is not implemented for ${this.name}`);
  }

  /**
   * List files matching an optional prefix
   * @param {object} [params]
   * @param {string} [params.prefix] - Key prefix
   * @param {number} [params.limit] - Max items to return
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<{ ok: boolean, files: Array<object>, count: number, isTruncated: boolean, nextCursor?: string }>}
   */
  async list(_params = {}) {
    throw new Error(`list() is not implemented for ${this.name}`);
  }

  /**
   * Delete file from storage
   * @param {object} params
   * @param {string} params.key - Target key / path
   * @returns {Promise<{ ok: boolean, key: string, deleted: boolean }>}
   */
  async delete(_params) {
    throw new Error(`delete() is not implemented for ${this.name}`);
  }

  /**
   * Retrieve file metadata without downloading body
   * @param {object} params
   * @param {string} params.key - Target key / path
   * @returns {Promise<object>} File metadata
   */
  async getMetadata(_params) {
    throw new Error(`getMetadata() is not implemented for ${this.name}`);
  }
}

module.exports = StorageProvider;

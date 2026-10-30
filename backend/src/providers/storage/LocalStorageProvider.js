/**
 * LocalStorageProvider — Safe application-managed persistent local filesystem storage.
 * Strictly confines files to the configured persistent storage directory,
 * preventing path traversal and enforcing file limits.
 */

const fs = require('fs');
const path = require('path');
const StorageProvider = require('./StorageProvider');
const {
  getStorageRoot,
  resolveSafePath,
  getRelativeStoragePath,
  formatBytes,
  getMimeType,
  parseContent,
  serializeContent,
  buildFileReference,
  MAX_FILE_SIZE_BYTES,
} = require('../../utils/FileSecurity');

class LocalStorageProvider extends StorageProvider {
  constructor(options = {}) {
    super({
      id: 'local',
      name: 'Local Storage',
    });
    this.storageRoot = options.storageRoot || getStorageRoot();
  }

  /**
   * Upload (write) file to local storage root
   */
  async upload({ key, content, encoding = 'utf8', contentType, format = 'text', overwrite = true }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for upload');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot });

    if (!overwrite && fs.existsSync(safePath)) {
      throw new Error(`File already exists at key "${key}" and overwrite is disabled`);
    }

    const buffer = serializeContent(content, format, encoding);

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${formatBytes(buffer.length)}) exceeds maximum permitted size of ${formatBytes(MAX_FILE_SIZE_BYTES)}`);
    }

    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, buffer);
    const stats = fs.statSync(safePath);
    const relKey = getRelativeStoragePath(safePath);

    return {
      ok: true,
      provider: 'local',
      key: relKey,
      path: relKey,
      filename: path.basename(safePath),
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      contentType: contentType || getMimeType(safePath),
      etag: `"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
    };
  }

  /**
   * Download (read) file from local storage root
   */
  async download({ key, format = 'text', encoding = 'utf8' }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for download');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot });

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found in storage at key "${key}"`);
    }

    const stats = fs.statSync(safePath);
    if (stats.isDirectory()) {
      throw new Error(`Target key "${key}" is a directory, not a file`);
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${formatBytes(stats.size)}) exceeds maximum permitted download limit`);
    }

    const rawBuffer = fs.readFileSync(safePath);
    const { content, rawContent } = parseContent(rawBuffer, format, encoding);

    const fileRef = buildFileReference(safePath, stats, content, format);
    return {
      ok: true,
      provider: 'local',
      key: fileRef.path,
      ...fileRef,
      rawContent,
    };
  }

  /**
   * List files within storage root matching optional prefix
   */
  async list({ prefix = '', limit = 100 } = {}) {
    const safeBase = this.storageRoot;
    if (!fs.existsSync(safeBase)) {
      return { ok: true, provider: 'local', files: [], count: 0, prefix, isTruncated: false };
    }

    const cleanPrefix = String(prefix || '').trim().replace(/^[/\\]+/, '');
    const results = [];

    const walk = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= limit) break;
        const fullPath = path.join(currentDir, entry.name);
        const relKey = getRelativeStoragePath(fullPath);

        if (cleanPrefix && !relKey.startsWith(cleanPrefix)) {
          if (entry.isDirectory() && cleanPrefix.startsWith(relKey)) {
            walk(fullPath);
          }
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          try {
            const stats = fs.statSync(fullPath);
            results.push({
              key: relKey,
              filename: entry.name,
              size: stats.size,
              sizeFormatted: formatBytes(stats.size),
              contentType: getMimeType(fullPath),
              etag: `"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`,
              modifiedAt: stats.mtime.toISOString(),
              isDirectory: false,
            });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    walk(safeBase);

    return {
      ok: true,
      provider: 'local',
      files: results,
      count: results.length,
      prefix: cleanPrefix,
      isTruncated: results.length >= limit,
    };
  }

  /**
   * Delete file from local storage
   */
  async delete({ key, ignoreMissing = false }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for delete');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot });

    if (!fs.existsSync(safePath)) {
      if (ignoreMissing) {
        return { ok: true, provider: 'local', key, deleted: false, message: 'File did not exist' };
      }
      throw new Error(`File not found in storage at key "${key}"`);
    }

    const stats = fs.statSync(safePath);
    if (stats.isDirectory()) {
      fs.rmSync(safePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(safePath);
    }

    return {
      ok: true,
      provider: 'local',
      key: getRelativeStoragePath(safePath),
      deleted: true,
    };
  }

  /**
   * Get metadata for a file in local storage
   */
  async getMetadata({ key }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for getMetadata');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot });

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found in storage at key "${key}"`);
    }

    const stats = fs.statSync(safePath);
    const relKey = getRelativeStoragePath(safePath);

    return {
      ok: true,
      provider: 'local',
      key: relKey,
      path: relKey,
      filename: path.basename(safePath),
      extension: path.extname(safePath).toLowerCase(),
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      contentType: getMimeType(safePath),
      etag: `"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  }
}

module.exports = LocalStorageProvider;


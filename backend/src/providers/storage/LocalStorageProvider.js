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
  async upload({ key, content, encoding = 'utf8', contentType, format = 'text', overwrite = true, ownerId }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for upload');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot, ownerId });
    const expectedStorageRoot = ownerId
      ? path.resolve(this.storageRoot, 'users', String(ownerId).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

    // Pre-write symlink defense: reject writing through an existing symlink
    if (fs.existsSync(safePath) && fs.lstatSync(safePath).isSymbolicLink()) {
      throw new Error(`Security Error: Symlink writing attempt rejected for key "${key}"`);
    }

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

    // Verify parent directory does not escape via symlink substitution
    const realDir = fs.realpathSync(dir);
    if (realDir !== expectedStorageRoot && !realDir.startsWith(expectedStorageRoot + path.sep)) {
      throw new Error(`Security Error: Parent directory symlink traversal rejected for key "${key}"`);
    }

    fs.writeFileSync(safePath, buffer);

    // Post-write symlink TOCTOU assertion: ensure target did not escape via concurrent symlink creation
    try {
      if (fs.lstatSync(safePath).isSymbolicLink()) {
        try { fs.unlinkSync(safePath); } catch {}
        throw new Error(`Security Error: Symlink TOCTOU substitution attack rejected for key "${key}"`);
      }

      const canonicalTarget = fs.realpathSync(safePath);
      const isContained = canonicalTarget === expectedStorageRoot || canonicalTarget.startsWith(expectedStorageRoot + path.sep);
      if (!isContained) {
        try { fs.unlinkSync(safePath); } catch {}
        throw new Error(`Security Error: Symlink TOCTOU substitution attack rejected for key "${key}"`);
      }
    } catch (err) {
      if (err.message && err.message.includes('Security Error')) throw err;
    }

    const stats = fs.statSync(safePath);
    const relKey = getRelativeStoragePath(safePath, { ownerId, baseDir: this.storageRoot });

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
  async download({ key, format = 'text', encoding = 'utf8', ownerId }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for download');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot, ownerId });
    const expectedStorageRoot = ownerId
      ? path.resolve(this.storageRoot, 'users', String(ownerId).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found in storage at key "${key}"`);
    }

    // Pre-read symlink verification
    const lstats = fs.lstatSync(safePath);
    if (lstats.isSymbolicLink()) {
      const realLinkTarget = fs.realpathSync(safePath);
      if (realLinkTarget !== expectedStorageRoot && !realLinkTarget.startsWith(expectedStorageRoot + path.sep)) {
        throw new Error(`Security Error: Symlink traversal attempt rejected for "${key}"`);
      }
    }

    const stats = fs.statSync(safePath);
    if (stats.isDirectory()) {
      throw new Error(`Target key "${key}" is a directory, not a file`);
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${formatBytes(stats.size)}) exceeds maximum permitted download limit`);
    }

    const rawBuffer = fs.readFileSync(safePath);

    // Post-read symlink verification
    const postReal = fs.realpathSync(safePath);
    if (postReal !== expectedStorageRoot && !postReal.startsWith(expectedStorageRoot + path.sep)) {
      throw new Error(`Security Error: Post-read symlink escape detected for "${key}"`);
    }

    const { content, rawContent } = parseContent(rawBuffer, format, encoding);

    const fileRef = buildFileReference(safePath, stats, content, format, { ownerId, baseDir: this.storageRoot });
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
  async list({ prefix = '', limit = 100, ownerId } = {}) {
    const rawOwner = ownerId;
    const safeBase = rawOwner
      ? path.resolve(this.storageRoot, 'users', String(rawOwner).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

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

        // Skip escaping symlinks during list traversal
        if (entry.isSymbolicLink()) {
          try {
            const realTarget = fs.realpathSync(fullPath);
            if (realTarget !== safeBase && !realTarget.startsWith(safeBase + path.sep)) {
              continue;
            }
          } catch {
            continue;
          }
        }

        const relKey = getRelativeStoragePath(fullPath, { ownerId, baseDir: this.storageRoot });

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
  async delete({ key, ignoreMissing = false, ownerId }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for delete');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot, ownerId });
    const expectedStorageRoot = ownerId
      ? path.resolve(this.storageRoot, 'users', String(ownerId).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

    if (!fs.existsSync(safePath)) {
      if (ignoreMissing) {
        return { ok: true, provider: 'local', key, deleted: false, message: 'File did not exist' };
      }
      throw new Error(`File not found in storage at key "${key}"`);
    }

    const lstats = fs.lstatSync(safePath);
    if (lstats.isSymbolicLink()) {
      // Unlink the symlink itself, never delete the target destination
      fs.unlinkSync(safePath);
      return {
        ok: true,
        provider: 'local',
        key: getRelativeStoragePath(safePath, { ownerId, baseDir: this.storageRoot }),
        deleted: true,
      };
    }

    const canonical = fs.realpathSync(safePath);
    if (canonical !== expectedStorageRoot && !canonical.startsWith(expectedStorageRoot + path.sep)) {
      throw new Error(`Security Error: Symlink deletion traversal rejected for key "${key}"`);
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
      key: getRelativeStoragePath(safePath, { ownerId, baseDir: this.storageRoot }),
      deleted: true,
    };
  }

  /**
   * Move or rename a file within local storage
   */
  async move({ sourceKey, destinationKey, ownerId, overwrite = false }) {
    if (!sourceKey || !String(sourceKey).trim()) {
      throw new Error('sourceKey is required for move');
    }
    if (!destinationKey || !String(destinationKey).trim()) {
      throw new Error('destinationKey is required for move');
    }

    const safeSrc = resolveSafePath(sourceKey, { baseDir: this.storageRoot, ownerId });
    const safeDest = resolveSafePath(destinationKey, { baseDir: this.storageRoot, ownerId });
    const expectedStorageRoot = ownerId
      ? path.resolve(this.storageRoot, 'users', String(ownerId).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

    if (!fs.existsSync(safeSrc)) {
      throw new Error(`Source file does not exist at "${sourceKey}"`);
    }

    if (fs.existsSync(safeDest) && !overwrite) {
      throw new Error(`Destination file already exists at "${destinationKey}" and overwrite is disabled`);
    }

    // Check source symlink escape
    if (fs.lstatSync(safeSrc).isSymbolicLink()) {
      const realSrc = fs.realpathSync(safeSrc);
      if (realSrc !== expectedStorageRoot && !realSrc.startsWith(expectedStorageRoot + path.sep)) {
        throw new Error(`Security Error: Source symlink traversal attempt rejected for "${sourceKey}"`);
      }
    }

    const destDir = path.dirname(safeDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(safeSrc, safeDest);

    // Post-move destination verification
    const realDest = fs.realpathSync(safeDest);
    if (realDest !== expectedStorageRoot && !realDest.startsWith(expectedStorageRoot + path.sep)) {
      throw new Error(`Security Error: Destination symlink traversal rejected for "${destinationKey}"`);
    }

    const stats = fs.statSync(safeDest);
    const relKey = getRelativeStoragePath(safeDest, { ownerId, baseDir: this.storageRoot });

    return {
      ok: true,
      provider: 'local',
      key: relKey,
      path: relKey,
      filename: path.basename(safeDest),
      size: stats.size,
    };
  }

  /**
   * Get metadata for a file in local storage
   */
  async getMetadata({ key, ownerId }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key / path is required for getMetadata');
    }

    const safePath = resolveSafePath(key, { baseDir: this.storageRoot, ownerId });
    const expectedStorageRoot = ownerId
      ? path.resolve(this.storageRoot, 'users', String(ownerId).replace(/[^a-zA-Z0-9_-]/g, ''))
      : this.storageRoot;

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found in storage at key "${key}"`);
    }

    const lstats = fs.lstatSync(safePath);
    if (lstats.isSymbolicLink()) {
      const realPath = fs.realpathSync(safePath);
      if (realPath !== expectedStorageRoot && !realPath.startsWith(expectedStorageRoot + path.sep)) {
        throw new Error(`Security Error: Symlink traversal attempt rejected for "${key}"`);
      }
    }

    const stats = fs.statSync(safePath);
    const relKey = getRelativeStoragePath(safePath, { ownerId, baseDir: this.storageRoot });

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


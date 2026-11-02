/**
 * FileSecurity — Security, validation, and serialization utility for file operations.
 * Enforces safe sandbox confinement, path traversal prevention, file size limits,
 * and standard file reference structures across LogicBridge workflows.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'data', 'storage');
const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_BYTES || '', 10) || 25 * 1024 * 1024; // 25 MB default limit

const MIME_TYPES = {
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.bin': 'application/octet-stream',
};

/**
 * Returns the resolved persistent storage root directory, creating it if needed.
 * @returns {string} Absolute normalized path
 */
function getStorageRoot() {
  const configured = process.env.LOGICBRIDGE_STORAGE_PATH || process.env.STORAGE_ROOT_DIR;
  const root = configured ? path.resolve(configured) : DEFAULT_STORAGE_DIR;
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

/**
 * Resolves and verifies that a relative file path resides strictly inside the storage root.
 * Throws a SecurityError if path traversal or illegal characters are detected.
 *
 * @param {string|object} userPath - User-supplied path, filename, or file reference object
 * @param {object} [options]
 * @param {string} [options.baseDir] - Override base directory (defaults to storage root)
 * @param {string} [options.ownerId] - User/owner ID for per-user sandbox isolation
 * @param {string} [options.userId] - Alias for ownerId
 * @returns {string} Absolute resolved safe path
 */
function resolveSafePath(userPath, options = {}) {
  // Support file reference object { path: '...' }
  const actualPath = typeof userPath === 'object' && userPath !== null
    ? (userPath.path || userPath.filePath || userPath.filename)
    : userPath;

  if (actualPath === undefined || actualPath === null || String(actualPath).trim() === '') {
    throw new Error('File path or filename is required');
  }

  const rawPath = String(actualPath).trim();

  // Decode percent-encoded characters to catch obfuscated traversal attempts (e.g., %2e%2e)
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    // Keep rawPath on malformed URI escape sequences
  }

  // Reject null bytes and control characters
  if (/\0/.test(rawPath) || /\0/.test(decodedPath)) {
    throw new Error('Security Error: Null bytes are not permitted in file paths');
  }

  // Reject Windows UNC network paths
  if (/^\\\\[^\\]/.test(rawPath) || /^\\\\[^\\]/.test(decodedPath)) {
    throw new Error('Security Error: UNC network paths are not permitted');
  }

  const baseStorage = options.baseDir ? path.resolve(options.baseDir) : getStorageRoot();
  const rawOwner = options.ownerId || options.userId;
  const storageRoot = rawOwner
    ? path.resolve(baseStorage, 'users', String(rawOwner).replace(/[^a-zA-Z0-9_-]/g, ''))
    : baseStorage;

  if (rawOwner && !fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  // Strip leading drive letters or absolute root slashes to confine to storageRoot
  let cleanRelative = decodedPath.replace(/^[a-zA-Z]:[/\\]+/, '').replace(/^[/\\]+/, '');
  cleanRelative = path.normalize(cleanRelative);

  const resolved = path.resolve(storageRoot, cleanRelative);

  // Strict containment assertion
  const isContained = resolved === storageRoot || resolved.startsWith(storageRoot + path.sep);
  if (!isContained) {
    throw new Error(`Security Error: Path traversal attempt rejected for "${rawPath}". Access denied outside storage root.`);
  }

  return resolved;
}

/**
 * Gets relative storage path for a resolved absolute path
 * @param {string} absolutePath
 * @param {object} [options]
 * @param {string} [options.ownerId] - User/owner ID for per-user sandbox isolation
 * @param {string} [options.userId] - Alias for ownerId
 * @returns {string} Forward-slash normalized relative path
 */
function getRelativeStoragePath(absolutePath, options = {}) {
  const baseStorage = getStorageRoot();
  const rawOwner = options.ownerId || options.userId;
  const storageRoot = rawOwner
    ? path.resolve(baseStorage, 'users', String(rawOwner).replace(/[^a-zA-Z0-9_-]/g, ''))
    : baseStorage;

  const rel = path.relative(storageRoot, absolutePath);
  return rel.split(path.sep).join('/');
}

/**
 * Returns formatted human-readable size string
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Detects MIME type from file extension
 * @param {string} filePath
 * @returns {string}
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Parses simple CSV text into an array of objects
 * @param {string} csvText
 * @param {string} [delimiter]
 * @returns {Array<object>}
 */
function parseCsv(csvText, delimiter = ',') {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseRow = (line) => {
    const row = [];
    let inQuotes = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    row.push(cur.trim());
    return row;
  };

  const headers = parseRow(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(record);
  }

  return rows;
}

/**
 * Formats an array of objects or values into a standard CSV string
 * @param {Array<object>} rows
 * @param {string} [delimiter]
 * @param {boolean} [includeHeaders=true]
 * @returns {string}
 */
function serializeCsv(rows, delimiter = ',', includeHeaders = true) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const first = rows[0];
  const headers = typeof first === 'object' && first !== null ? Object.keys(first) : ['value'];

  const escapeCell = (val) => {
    const s = String(val ?? '');
    if (s.includes(delimiter) || s.includes('\n') || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [];
  if (includeHeaders) {
    lines.push(headers.map(escapeCell).join(delimiter));
  }

  rows.forEach((row) => {
    if (typeof row === 'object' && row !== null) {
      lines.push(headers.map((h) => escapeCell(row[h])).join(delimiter));
    } else {
      lines.push(escapeCell(row));
    }
  });

  return lines.join('\n');
}

/**
 * Parses raw file buffer/string into the requested format (text, json, csv, binary)
 * @param {Buffer|string} raw
 * @param {string} format
 * @param {string} [encoding]
 * @returns {{ content: any, rawContent: string|null, encoding: string }}
 */
function parseContent(raw, format = 'text', encoding = 'utf8') {
  const normFormat = String(format || 'text').toLowerCase().trim();

  if (normFormat === 'binary' || encoding === 'base64') {
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), encoding === 'base64' ? 'base64' : 'utf8');
    const base64Str = buffer.toString('base64');
    return {
      content: base64Str,
      rawContent: base64Str,
      encoding: 'base64',
    };
  }

  const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');

  if (normFormat === 'json') {
    try {
      const parsed = JSON.parse(str);
      return {
        content: parsed,
        rawContent: str,
        encoding: 'utf8',
      };
    } catch {
      return { content: str, rawContent: str, encoding: 'utf8' };
    }
  }

  if (normFormat === 'csv') {
    const rows = parseCsv(str);
    return {
      content: rows,
      rawContent: str,
      encoding: 'utf8',
    };
  }

  return {
    content: str,
    rawContent: str,
    encoding: 'utf8',
  };
}

/**
 * Serializes arbitrary input into a Buffer ready for writing or uploading
 * @param {any} input
 * @param {string} format
 * @param {string} [encoding]
 * @returns {Buffer}
 */
function serializeContent(input, format = 'text', encoding = 'utf8') {
  if (Buffer.isBuffer(input)) return input;

  const normFormat = String(format || 'text').toLowerCase().trim();

  if (normFormat === 'binary' || encoding === 'base64') {
    if (typeof input === 'string') {
      return Buffer.from(input, 'base64');
    }
  }

  if (normFormat === 'json' && typeof input === 'object' && input !== null) {
    return Buffer.from(JSON.stringify(input, null, 2), 'utf8');
  }

  if (normFormat === 'csv' && Array.isArray(input)) {
    return Buffer.from(serializeCsv(input), 'utf8');
  }

  if (typeof input === 'object' && input !== null) {
    // If input is an existing file reference object
    if (input.$type === 'file_reference' && input.content !== undefined) {
      return serializeContent(input.content, input.format || normFormat, input.encoding);
    }
    return Buffer.from(JSON.stringify(input, null, 2), 'utf8');
  }

  return Buffer.from(String(input ?? ''), 'utf8');
}

/**
 * Builds standard, consistent file reference object
 * @param {string} absolutePath
 * @param {fs.Stats} [stats]
 * @param {any} [content]
 * @param {string} [format]
 * @returns {object} Standard file reference
 */
function buildFileReference(absolutePath, stats, content, format = 'text') {
  const statObj = stats || (fs.existsSync(absolutePath) ? fs.statSync(absolutePath) : null);
  const size = statObj ? statObj.size : 0;
  const filename = path.basename(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const relPath = getRelativeStoragePath(absolutePath);

  const fileRef = {
    $type: 'file_reference',
    name: filename,
    filename,
    path: relPath,
    extension: ext,
    size,
    sizeFormatted: formatBytes(size),
    mimeType: getMimeType(absolutePath),
    format,
    encoding: format === 'binary' ? 'base64' : 'utf8',
    content: content !== undefined ? content : undefined,
    createdAt: statObj?.birthtime?.toISOString() || new Date().toISOString(),
    modifiedAt: statObj?.mtime?.toISOString() || new Date().toISOString(),
  };

  // Define absolutePath as non-enumerable to prevent leaking server filesystem paths in API responses, logs, or exports
  Object.defineProperty(fileRef, 'absolutePath', {
    value: absolutePath,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return fileRef;
}

module.exports = {
  getStorageRoot,
  resolveSafePath,
  getRelativeStoragePath,
  formatBytes,
  getMimeType,
  parseCsv,
  serializeCsv,
  parseContent,
  serializeContent,
  buildFileReference,
  MAX_FILE_SIZE_BYTES,
};


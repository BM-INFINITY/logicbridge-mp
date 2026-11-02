/**
 * FileNode — File operations node in LogicBridge.
 * Supports:
 *   - Read File (text, JSON, CSV, binary/base64)
 *   - Write File (overwrite / append, text, JSON, CSV, binary)
 *   - Create File (safe empty or initialized file creation)
 *   - Delete File (file or directory removal with ignoreMissing option)
 *   - Get File Metadata (size, mimeType, timestamps, file checks)
 *   - Move / Rename File (safe path-confined file relocation)
 */

const fs = require('fs');
const path = require('path');
const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable, resolveRawValue, redactSecrets } = require('../utils');
const NodeExecutionError = require('../errors/NodeExecutionError');
const {
  resolveSafePath,
  getRelativeStoragePath,
  formatBytes,
  getMimeType,
  parseContent,
  serializeContent,
  serializeCsv,
  buildFileReference,
  MAX_FILE_SIZE_BYTES,
} = require('../utils/FileSecurity');

class FileNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_FILE,
      name: 'File Operations',
      category: 'action',
      icon: 'HardDrive',
      description: 'Read, write, create, delete, and inspect files with support for text, JSON, CSV, and binary formats',
      version: '1.0.0',
    });
  }

  _normalizeOp(op = '') {
    const raw = String(op).toLowerCase().trim().replace(/[-_\s]+/g, '_');
    if (['read_file', 'read', 'load_file', 'open_file'].includes(raw)) return 'read_file';
    if (['write_file', 'write', 'save_file'].includes(raw)) return 'write_file';
    if (['create_file', 'create', 'touch_file', 'new_file'].includes(raw)) return 'create_file';
    if (['delete_file', 'delete', 'remove_file', 'unlink'].includes(raw)) return 'delete_file';
    if (['get_metadata', 'metadata', 'get_file_metadata', 'file_info', 'stat'].includes(raw)) return 'get_metadata';
    if (['move_file', 'rename_file', 'move', 'rename'].includes(raw)) return 'move_file';
    return raw;
  }

  validate(node) {
    const data = node?.data || {};
    const operation = this._normalizeOp(data.operation || 'read_file');

    const validOps = ['read_file', 'write_file', 'create_file', 'delete_file', 'get_metadata', 'move_file'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${data.operation}". Supported: ${validOps.join(', ')}` };
    }

    const filePath = data.path || data.filePath || data.filename;

    if (operation === 'move_file') {
      const src = data.sourcePath || filePath;
      const dest = data.destinationPath || data.newPath;
      if (!src || !String(src).trim()) {
        return { valid: false, error: 'Source file path is required for Move / Rename' };
      }
      if (!dest || !String(dest).trim()) {
        return { valid: false, error: 'Destination file path is required for Move / Rename' };
      }
    } else {
      if (!filePath || !String(filePath).trim()) {
        return { valid: false, error: `File path or filename is required for ${operation.replace('_', ' ')}` };
      }
    }

    if (operation === 'write_file') {
      if (data.content === undefined && data.data === undefined && data.text === undefined && !data.sourceStep) {
        return { valid: false, error: 'Content is required for Write File' };
      }
    }

    return { valid: true };
  }

  async execute(node, context, options = {}) {
    const startedAt = Date.now();
    const data = node?.data || {};

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    const operation = this._normalizeOp(data.operation || 'read_file');

    // 1. Resolve variables in path and options
    const rawPathObj = data.path || data.filePath || data.filename || '';
    const rawPath = typeof rawPathObj === 'object' && rawPathObj?.path ? rawPathObj.path : rawPathObj;
    const resolvedPath = rawPath ? resolveVariable(String(rawPath), context) : '';

    const securityOpts = { ownerId: context?.ownerId || data.ownerId };

    const rawFormat = data.format || 'text';
    const resolvedFormat = resolveVariable(String(rawFormat), context).toLowerCase();

    const rawEncoding = data.encoding || (resolvedFormat === 'binary' ? 'base64' : 'utf8');
    const resolvedEncoding = resolveVariable(String(rawEncoding), context).toLowerCase();

    let resultPayload = null;

    try {
      switch (operation) {
        case 'read_file': {
          const safePath = resolveSafePath(resolvedPath, securityOpts);

          if (!fs.existsSync(safePath)) {
            throw new Error(`File not found at path "${resolvedPath}"`);
          }

          const stats = fs.statSync(safePath);
          if (stats.isDirectory()) {
            throw new Error(`Path "${resolvedPath}" is a directory, not a file`);
          }

          const maxLimit = data.maxBytes ? parseInt(data.maxBytes, 10) : MAX_FILE_SIZE_BYTES;
          if (stats.size > maxLimit) {
            throw new Error(`File size (${formatBytes(stats.size)}) exceeds maximum limit of ${formatBytes(maxLimit)}`);
          }

          const rawBuffer = fs.readFileSync(safePath);
          const { content, rawContent, encoding } = parseContent(rawBuffer, resolvedFormat, resolvedEncoding);
          const fileRef = buildFileReference(safePath, stats, content, resolvedFormat);

          resultPayload = {
            ok: true,
            operation: 'read_file',
            file: fileRef,
            ...fileRef,
            rawContent,
            encoding,
            records: resolvedFormat === 'csv' && Array.isArray(content) ? content : undefined,
          };
          break;
        }

        case 'write_file': {
          const safePath = resolveSafePath(resolvedPath, securityOpts);

          let rawContent = data.content !== undefined ? data.content : (data.data !== undefined ? data.data : (data.text !== undefined ? data.text : ''));

          // If content is a template string containing variables, resolve it
          if (typeof rawContent === 'string') {
            const rawVal = resolveRawValue(rawContent, context);
            rawContent = rawVal !== undefined && rawVal !== '' ? rawVal : resolveVariable(rawContent, context);
          } else if (typeof rawContent === 'object' && rawContent !== null) {
            // Check if input is a file reference from a previous step
            if (rawContent.$type === 'file_reference') {
              rawContent = rawContent.content !== undefined ? rawContent.content : (rawContent.rawContent || '');
            }
          }

          const isAppend = Boolean(data.append || data.mode === 'append');
          const overwrite = data.overwrite !== undefined ? Boolean(data.overwrite) : true;

          if (!isAppend && !overwrite && fs.existsSync(safePath)) {
            throw new Error(`File already exists at "${resolvedPath}" and overwrite is disabled`);
          }

          const fileExists = fs.existsSync(safePath) && fs.statSync(safePath).size > 0;
          let buffer;
          if (isAppend && fileExists && resolvedFormat === 'csv' && Array.isArray(rawContent)) {
            const existingText = fs.readFileSync(safePath, 'utf8');
            const prefixNewline = existingText.length > 0 && !existingText.endsWith('\n') ? '\n' : '';
            buffer = Buffer.from(prefixNewline + serializeCsv(rawContent, ',', false), 'utf8');
          } else {
            buffer = serializeContent(rawContent, resolvedFormat, resolvedEncoding);
          }

          if (buffer.length > MAX_FILE_SIZE_BYTES) {
            throw new Error(`Content size (${formatBytes(buffer.length)}) exceeds maximum permitted file limit`);
          }

          const dir = path.dirname(safePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          if (isAppend) {
            fs.appendFileSync(safePath, buffer);
          } else {
            fs.writeFileSync(safePath, buffer);
          }

          const stats = fs.statSync(safePath);
          const fileRef = buildFileReference(safePath, stats, rawContent, resolvedFormat);

          resultPayload = {
            ok: true,
            operation: 'write_file',
            mode: isAppend ? 'append' : 'overwrite',
            bytesWritten: buffer.length,
            file: fileRef,
            ...fileRef,
          };
          break;
        }

        case 'create_file': {
          const safePath = resolveSafePath(resolvedPath, securityOpts);

          if (fs.existsSync(safePath) && data.failIfExists) {
            throw new Error(`File already exists at "${resolvedPath}"`);
          }

          const initialContent = data.initialContent ? resolveVariable(String(data.initialContent), context) : '';
          const buffer = serializeContent(initialContent, resolvedFormat, resolvedEncoding);

          const dir = path.dirname(safePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(safePath, buffer);
          const stats = fs.statSync(safePath);
          const fileRef = buildFileReference(safePath, stats, initialContent, resolvedFormat);

          resultPayload = {
            ok: true,
            operation: 'create_file',
            created: true,
            file: fileRef,
            ...fileRef,
          };
          break;
        }

        case 'delete_file': {
          const safePath = resolveSafePath(resolvedPath, securityOpts);
          const ignoreMissing = Boolean(data.ignoreMissing || data.ignoreNotFound);

          if (!fs.existsSync(safePath)) {
            if (ignoreMissing) {
              resultPayload = {
                ok: true,
                operation: 'delete_file',
                deleted: false,
                path: getRelativeStoragePath(safePath, securityOpts),
                message: 'File did not exist',
              };
              break;
            }
            throw new Error(`File not found for deletion at "${resolvedPath}"`);
          }

          const stats = fs.statSync(safePath);
          if (stats.isDirectory()) {
            fs.rmSync(safePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(safePath);
          }

          resultPayload = {
            ok: true,
            operation: 'delete_file',
            deleted: true,
            path: getRelativeStoragePath(safePath, securityOpts),
            filename: path.basename(safePath),
          };
          break;
        }

        case 'get_metadata': {
          const safePath = resolveSafePath(resolvedPath, securityOpts);

          if (!fs.existsSync(safePath)) {
            throw new Error(`File not found at path "${resolvedPath}"`);
          }

          const stats = fs.statSync(safePath);
          const relKey = getRelativeStoragePath(safePath, securityOpts);
          const fileRef = buildFileReference(safePath, stats, undefined, resolvedFormat);

          resultPayload = {
            ok: true,
            operation: 'get_metadata',
            file: fileRef,
            ...fileRef,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
          };
          break;
        }

        case 'move_file': {
          const rawSrc = data.sourcePath || rawPath;
          const rawDest = data.destinationPath || data.newPath;
          const resolvedSrc = resolveVariable(String(rawSrc), context);
          const resolvedDest = resolveVariable(String(rawDest), context);

          const safeSrc = resolveSafePath(resolvedSrc, securityOpts);
          const safeDest = resolveSafePath(resolvedDest, securityOpts);

          if (!fs.existsSync(safeSrc)) {
            throw new Error(`Source file does not exist at "${resolvedSrc}"`);
          }

          const overwrite = Boolean(data.overwrite);
          if (fs.existsSync(safeDest) && !overwrite) {
            throw new Error(`Destination file already exists at "${resolvedDest}" and overwrite is disabled`);
          }

          const destDir = path.dirname(safeDest);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          fs.renameSync(safeSrc, safeDest);
          const stats = fs.statSync(safeDest);
          const fileRef = buildFileReference(safeDest, stats, undefined, resolvedFormat);

          resultPayload = {
            ok: true,
            operation: 'move_file',
            previousPath: getRelativeStoragePath(safeSrc),
            file: fileRef,
            ...fileRef,
          };
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported file operation "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      const errMsg = redactSecrets(err.message || 'Unknown file operation error');
      throw new NodeExecutionError(errMsg, {
        nodeId: node.id,
        nodeType: this.type,
        nodeName: node.data?.label,
        originalError: err,
      });
    }

    const durationMs = Date.now() - startedAt;
    return redactSecrets({
      ...resultPayload,
      durationMs,
    });
  }
}

module.exports = FileNode;

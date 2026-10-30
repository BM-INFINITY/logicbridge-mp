/**
 * StorageNode — Cloud and Local storage operations node in LogicBridge.
 * Supports:
 *   - Upload File (local storage or AWS S3 with bucket/key specification)
 *   - Download File (returns standard file reference payload)
 *   - List Files (with prefix and pagination)
 *   - Delete File (removes object from storage)
 *   - Get File Metadata (retrieves size, mimeType, etag, and timestamps)
 */

const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable, redactSecrets } = require('../utils');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');
const { storageRegistry } = require('../providers/storage');

class StorageNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_STORAGE,
      name: 'Storage Operations',
      category: 'action',
      icon: 'Cloud',
      description: 'Upload, download, list, delete, and inspect files across Local Storage and AWS S3',
      version: '1.0.0',
    });
  }

  _normalizeOp(op = '') {
    const raw = String(op).toLowerCase().trim().replace(/[-_\s]+/g, '_');
    if (['upload', 'upload_file', 'put_file', 'put_object', 'store_file'].includes(raw)) return 'upload';
    if (['download', 'download_file', 'get_file', 'get_object'].includes(raw)) return 'download';
    if (['list', 'list_files', 'list_objects'].includes(raw)) return 'list';
    if (['delete', 'delete_file', 'delete_object', 'remove_file'].includes(raw)) return 'delete';
    if (['get_metadata', 'metadata', 'get_object_metadata', 'head_object', 'stat'].includes(raw)) return 'get_metadata';
    return raw;
  }

  validate(node) {
    const data = node?.data || {};
    const operation = this._normalizeOp(data.operation || 'upload');
    const provider = String(data.provider || 'local').toLowerCase().trim();

    const validOps = ['upload', 'download', 'list', 'delete', 'get_metadata'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${data.operation}". Supported: ${validOps.join(', ')}` };
    }

    if (provider === 'aws_s3' || provider === 's3') {
      const hasCreds = Boolean(data.connectionId || (data.accessKeyId && data.secretAccessKey));
      if (!hasCreds) {
        return { valid: false, error: 'AWS S3 connection or Access Key credentials are required' };
      }
    }

    if (operation === 'upload') {
      if (!data.key && !data.path && !data.filename) {
        return { valid: false, error: 'Storage key or path is required for Upload' };
      }
      if (data.content === undefined && data.file === undefined && data.data === undefined && data.text === undefined && !data.sourceStep) {
        return { valid: false, error: 'Content or file reference is required for Upload' };
      }
    }

    if (['download', 'delete', 'get_metadata'].includes(operation)) {
      if (!data.key && !data.path && !data.filename) {
        return { valid: false, error: `Storage key is required for ${operation.replace('_', ' ')}` };
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

    const operation = this._normalizeOp(data.operation || 'upload');
    const rawProvider = String(data.provider || 'local').toLowerCase().trim();
    const providerId = rawProvider === 's3' ? 'aws_s3' : rawProvider;

    // 1. Resolve credentials if S3
    let credentials = {};
    if (providerId === 'aws_s3' || providerId === 's3') {
      if (data.connectionId) {
        const ownerId = context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
        try {
          credentials = await ConnectionService.getDecryptedCredentials(data.connectionId, ownerId);
        } catch (err) {
          throw new NodeExecutionError(`Failed to retrieve S3 connection: ${err.message}`, {
            nodeId: node.id,
            nodeType: this.type,
            originalError: err,
          });
        }
      } else {
        credentials = {
          accessKeyId: data.accessKeyId ? resolveVariable(data.accessKeyId, context) : '',
          secretAccessKey: data.secretAccessKey ? resolveVariable(data.secretAccessKey, context) : '',
          region: data.region ? resolveVariable(data.region, context) : 'us-east-1',
          bucket: data.bucket ? resolveVariable(data.bucket, context) : '',
          endpoint: data.endpoint ? resolveVariable(data.endpoint, context) : '',
          sessionToken: data.sessionToken ? resolveVariable(data.sessionToken, context) : '',
        };
      }
    }

    // Attach mock HTTP client if injected for testing
    const clientOverride = options._s3Client || context?._s3Client || this._s3Client || credentials._axiosClient;
    if (clientOverride) {
      credentials._axiosClient = clientOverride;
    }

    const storage = storageRegistry.resolve(providerId, credentials);

    // 2. Resolve parameters & variables
    const rawKey = data.key || data.path || data.filename || '';
    const resolvedKey = rawKey ? resolveVariable(String(rawKey), context) : '';
    const rawBucket = data.bucket || credentials.bucket || '';
    const resolvedBucket = rawBucket ? resolveVariable(String(rawBucket), context) : '';

    let resultPayload = null;

    try {
      switch (operation) {
        case 'upload': {
          let rawContent = data.content !== undefined ? data.content : (data.file !== undefined ? data.file : (data.data !== undefined ? data.data : ''));

          let contentType = data.contentType ? resolveVariable(String(data.contentType), context) : undefined;
          let format = data.format ? resolveVariable(String(data.format), context) : 'text';
          let encoding = data.encoding ? resolveVariable(String(data.encoding), context) : 'utf8';

          // If content is a variable expression e.g. {{ steps.csv_step }}, resolve it
          if (typeof rawContent === 'string') {
            const resolved = resolveVariable(rawContent, context);
            try {
              rawContent = JSON.parse(resolved);
            } catch {
              rawContent = resolved;
            }
          }

          // If content is an existing file reference object, inherit its properties
          if (typeof rawContent === 'object' && rawContent !== null) {
            if (rawContent.$type === 'file_reference') {
              contentType = contentType || rawContent.mimeType;
              format = format || rawContent.format || 'text';
              encoding = encoding || rawContent.encoding || 'utf8';
              rawContent = rawContent.content !== undefined ? rawContent.content : (rawContent.rawContent || '');
            } else if (rawContent.csvContent) {
              rawContent = rawContent.csvContent;
              contentType = contentType || 'text/csv';
            }
          }

          const uploadRes = await storage.upload({
            key: resolvedKey,
            content: rawContent,
            contentType,
            format,
            encoding,
            bucket: resolvedBucket,
            clientOverride,
          });

          resultPayload = {
            ok: true,
            operation: 'upload',
            provider: providerId,
            file: uploadRes,
            ...uploadRes,
          };
          break;
        }

        case 'download': {
          const format = data.format ? resolveVariable(String(data.format), context) : 'text';
          const encoding = data.encoding ? resolveVariable(String(data.encoding), context) : 'utf8';

          const downloadRes = await storage.download({
            key: resolvedKey,
            format,
            encoding,
            bucket: resolvedBucket,
            clientOverride,
          });

          resultPayload = {
            ok: true,
            operation: 'download',
            provider: providerId,
            file: downloadRes,
            ...downloadRes,
          };
          break;
        }

        case 'list': {
          const rawPrefix = data.prefix || '';
          const resolvedPrefix = rawPrefix ? resolveVariable(String(rawPrefix), context) : '';
          const limit = data.limit ? parseInt(data.limit, 10) : 100;
          const cursor = data.cursor ? resolveVariable(String(data.cursor), context) : '';

          const listRes = await storage.list({
            prefix: resolvedPrefix,
            limit,
            cursor,
            bucket: resolvedBucket,
            clientOverride,
          });

          resultPayload = {
            ok: true,
            operation: 'list',
            provider: providerId,
            ...listRes,
          };
          break;
        }

        case 'delete': {
          const deleteRes = await storage.delete({
            key: resolvedKey,
            bucket: resolvedBucket,
            clientOverride,
          });

          resultPayload = {
            ok: true,
            operation: 'delete',
            provider: providerId,
            ...deleteRes,
          };
          break;
        }

        case 'get_metadata': {
          const metaRes = await storage.getMetadata({
            key: resolvedKey,
            bucket: resolvedBucket,
            clientOverride,
          });

          resultPayload = {
            ok: true,
            operation: 'get_metadata',
            provider: providerId,
            ...metaRes,
          };
          break;
        }

        default:
          throw new NodeExecutionError(`Unsupported storage operation "${operation}"`, { nodeId: node.id });
      }
    } catch (err) {
      const errMsg = redactSecrets(err.message || 'Unknown storage operation error');
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

module.exports = StorageNode;

/**
 * S3StorageProvider — AWS S3 and S3-compatible (MinIO, LocalStack, Cloudflare R2) storage provider.
 * Implements standard AWS Signature Version 4 (SigV4) REST communication with automatic
 * backoff retries, secret redaction, and mock client injection for automated testing.
 */

const crypto = require('crypto');
const axios = require('axios');
const StorageProvider = require('./StorageProvider');
const {
  formatBytes,
  getMimeType,
  parseContent,
  serializeContent,
  MAX_FILE_SIZE_BYTES,
} = require('../../utils/FileSecurity');
const { redactSecrets } = require('../../utils/SecretRedactor');

class S3StorageProvider extends StorageProvider {
  /**
   * @param {object} credentials
   * @param {string} credentials.accessKeyId - AWS Access Key ID
   * @param {string} credentials.secretAccessKey - AWS Secret Access Key
   * @param {string} [credentials.region] - AWS Region (defaults to 'us-east-1')
   * @param {string} [credentials.bucket] - Default bucket name
   * @param {string} [credentials.endpoint] - Custom S3 endpoint URL
   * @param {string} [credentials.sessionToken] - STS session token
   * @param {boolean} [credentials.forcePathStyle] - Force path-style bucket URLs
   * @param {Function} [credentials._axiosClient] - Mock HTTP client for testing
   */
  constructor(credentials = {}) {
    super({
      id: 'aws_s3',
      name: 'AWS S3',
    });
    this.accessKeyId = credentials.accessKeyId || credentials.keyId || '';
    this.secretAccessKey = credentials.secretAccessKey || credentials.secretKey || '';
    this.region = credentials.region || 'us-east-1';
    this.defaultBucket = credentials.bucket || '';
    this.endpoint = credentials.endpoint || '';
    this.sessionToken = credentials.sessionToken || '';
    this.forcePathStyle = Boolean(credentials.forcePathStyle || this.endpoint);
    this._httpClient = credentials._axiosClient || credentials._s3Client || null;
  }

  // ─── AWS SigV4 Helpers ──────────────────────────────────────────────────────

  _sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _hmac(key, data, encoding) {
    const h = crypto.createHmac('sha256', key).update(data);
    return encoding ? h.digest(encoding) : h.digest();
  }

  _getSignatureKey(secretKey, dateStamp, region, service = 's3') {
    const kDate = this._hmac('AWS4' + secretKey, dateStamp);
    const kRegion = this._hmac(kDate, region);
    const kService = this._hmac(kRegion, service);
    return this._hmac(kService, 'aws4_request');
  }

  /**
   * Signs and executes an AWS S3 REST API call with SigV4
   */
  async _request({ method = 'GET', bucket, key = '', query = {}, headers = {}, body = Buffer.alloc(0), clientOverride }) {
    const activeBucket = bucket || this.defaultBucket;
    if (!activeBucket) {
      throw new Error('S3 bucket name is required');
    }

    const cleanKey = String(key || '').replace(/^\/+/, '');
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // Determine host and URL
    let host;
    let url;
    let canonicalUri;

    if (this.endpoint) {
      const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
      const urlObj = new URL(cleanEndpoint);
      host = urlObj.host;
      if (this.forcePathStyle) {
        canonicalUri = `/${activeBucket}${cleanKey ? '/' + cleanKey : ''}`;
        url = `${cleanEndpoint}${canonicalUri}`;
      } else {
        host = `${activeBucket}.${host}`;
        canonicalUri = `/${cleanKey}`;
        url = `${urlObj.protocol}//${host}${canonicalUri}`;
      }
    } else {
      if (this.forcePathStyle) {
        host = `s3.${this.region}.amazonaws.com`;
        canonicalUri = `/${activeBucket}${cleanKey ? '/' + cleanKey : ''}`;
        url = `https://${host}${canonicalUri}`;
      } else {
        host = `${activeBucket}.s3.${this.region}.amazonaws.com`;
        canonicalUri = `/${cleanKey}`;
        url = `https://${host}${canonicalUri}`;
      }
    }

    // Canonical query string
    const queryEntries = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
    const canonicalQueryString = queryEntries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`)
      .join('&');

    if (canonicalQueryString) {
      url += (url.includes('?') ? '&' : '?') + canonicalQueryString;
    }

    // Payload hash
    const payloadHash = this._sha256(body);

    // Canonical headers
    const reqHeaders = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...headers,
    };

    if (this.sessionToken) {
      reqHeaders['x-amz-security-token'] = this.sessionToken;
    }

    const sortedHeaderKeys = Object.keys(reqHeaders).map((k) => k.toLowerCase()).sort();
    const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${reqHeaders[k]}`).join('\n') + '\n';
    const signedHeaders = sortedHeaderKeys.join(';');

    // Canonical request
    const canonicalRequest = [
      method.toUpperCase(),
      canonicalUri || '/',
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this._sha256(canonicalRequest),
    ].join('\n');

    // Calculate signature
    const signingKey = this._getSignatureKey(this.secretAccessKey, dateStamp, this.region);
    const signature = this._hmac(signingKey, stringToSign, 'hex');

    reqHeaders.Authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const httpClient = clientOverride || this._httpClient || axios;
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await httpClient({
          method,
          url,
          headers: reqHeaders,
          data: body.length > 0 ? body : undefined,
          responseType: method === 'GET' && query['list-type'] ? 'text' : 'arraybuffer',
          timeout: 20000,
        });
        return response;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        if (status === 429 || status === 503 || status === 500) {
          const waitMs = Math.min(attempt * 500, 2000);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }
        break;
      }
    }

    // Redact secret credentials from error
    const rawMsg = lastError?.response?.data
      ? (typeof lastError.response.data === 'string' ? lastError.response.data : JSON.stringify(lastError.response.data))
      : (lastError?.message || 'S3 request failed');

    const cleanMsg = redactSecrets(rawMsg);
    throw new Error(`S3 Error (${method} ${canonicalUri}): ${cleanMsg}`);
  }

  // ─── Simple S3 XML Parser for ListObjectsV2 ─────────────────────────────────

  _parseListXml(xmlStr) {
    const files = [];
    if (!xmlStr || typeof xmlStr !== 'string') return files;

    // Fast regex parser for <Contents> tags in S3 ListObjectsV2 XML
    const itemRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
    let match;

    while ((match = itemRegex.exec(xmlStr)) !== null) {
      const block = match[1];
      const keyMatch = /<Key>(.*?)<\/Key>/.exec(block);
      const sizeMatch = /<Size>(.*?)<\/Size>/.exec(block);
      const modifiedMatch = /<LastModified>(.*?)<\/LastModified>/.exec(block);
      const etagMatch = /<ETag>(.*?)<\/ETag>/.exec(block);

      if (keyMatch) {
        const key = keyMatch[1];
        const size = parseInt(sizeMatch?.[1] || '0', 10);
        files.push({
          key,
          filename: key.split('/').pop(),
          size,
          sizeFormatted: formatBytes(size),
          contentType: getMimeType(key),
          etag: (etagMatch?.[1] || '').replace(/&quot;/g, '"'),
          modifiedAt: modifiedMatch?.[1] || new Date().toISOString(),
          isDirectory: key.endsWith('/'),
        });
      }
    }

    return files;
  }

  // ─── Core Storage Provider Operations ──────────────────────────────────────

  /**
   * Upload file to AWS S3 bucket
   */
  async upload({ key, content, encoding = 'utf8', contentType, format = 'text', bucket, clientOverride }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key is required for S3 upload');
    }

    const cleanKey = String(key).replace(/^\/+/, '');
    const buffer = serializeContent(content, format, encoding);

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${formatBytes(buffer.length)}) exceeds maximum permitted upload limit`);
    }

    const type = contentType || getMimeType(cleanKey);

    const res = await this._request({
      method: 'PUT',
      bucket,
      key: cleanKey,
      headers: {
        'Content-Type': type,
        'Content-Length': String(buffer.length),
      },
      body: buffer,
      clientOverride,
    });

    const targetBucket = bucket || this.defaultBucket;
    const etag = res.headers?.etag || res.headers?.ETag || '';

    return {
      ok: true,
      provider: 'aws_s3',
      bucket: targetBucket,
      key: cleanKey,
      filename: cleanKey.split('/').pop(),
      size: buffer.length,
      sizeFormatted: formatBytes(buffer.length),
      contentType: type,
      etag,
      url: `https://${targetBucket}.s3.${this.region}.amazonaws.com/${cleanKey}`,
      modifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Download file from AWS S3 bucket
   */
  async download({ key, format = 'text', encoding = 'utf8', bucket, clientOverride }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key is required for S3 download');
    }

    const cleanKey = String(key).replace(/^\/+/, '');

    const res = await this._request({
      method: 'GET',
      bucket,
      key: cleanKey,
      clientOverride,
    });

    const rawBuffer = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data || '');
    const { content, rawContent } = parseContent(rawBuffer, format, encoding);
    const targetBucket = bucket || this.defaultBucket;

    return {
      $type: 'file_reference',
      ok: true,
      provider: 'aws_s3',
      bucket: targetBucket,
      key: cleanKey,
      name: cleanKey.split('/').pop(),
      filename: cleanKey.split('/').pop(),
      path: cleanKey,
      extension: ('.' + cleanKey.split('.').pop()).toLowerCase(),
      size: rawBuffer.length,
      sizeFormatted: formatBytes(rawBuffer.length),
      contentType: res.headers?.['content-type'] || getMimeType(cleanKey),
      etag: res.headers?.etag || '',
      encoding: format === 'binary' ? 'base64' : 'utf8',
      format,
      content,
      rawContent,
      modifiedAt: res.headers?.['last-modified'] || new Date().toISOString(),
    };
  }

  /**
   * List files in AWS S3 bucket with prefix
   */
  async list({ prefix = '', limit = 100, cursor = '', bucket, clientOverride } = {}) {
    const query = {
      'list-type': '2',
      'max-keys': String(limit),
    };
    if (prefix) query.prefix = prefix;
    if (cursor) query['continuation-token'] = cursor;

    const res = await this._request({
      method: 'GET',
      bucket,
      query,
      clientOverride,
    });

    const responseText = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : String(res.data || '');

    let files = [];
    if (typeof res.data === 'object' && Array.isArray(res.data.files)) {
      files = res.data.files;
    } else {
      files = this._parseListXml(responseText);
    }

    const isTruncated = /<IsTruncated>true<\/IsTruncated>/i.test(responseText);
    const nextCursorMatch = /<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(responseText);

    return {
      ok: true,
      provider: 'aws_s3',
      bucket: bucket || this.defaultBucket,
      files,
      count: files.length,
      prefix,
      isTruncated,
      nextCursor: nextCursorMatch ? nextCursorMatch[1] : undefined,
    };
  }

  /**
   * Delete file from AWS S3 bucket
   */
  async delete({ key, bucket, clientOverride }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key is required for S3 delete');
    }

    const cleanKey = String(key).replace(/^\/+/, '');

    await this._request({
      method: 'DELETE',
      bucket,
      key: cleanKey,
      clientOverride,
    });

    return {
      ok: true,
      provider: 'aws_s3',
      bucket: bucket || this.defaultBucket,
      key: cleanKey,
      deleted: true,
    };
  }

  /**
   * Get metadata for an object in S3 (HEAD request)
   */
  async getMetadata({ key, bucket, clientOverride }) {
    if (!key || !String(key).trim()) {
      throw new Error('Storage key is required for S3 getMetadata');
    }

    const cleanKey = String(key).replace(/^\/+/, '');

    const res = await this._request({
      method: 'HEAD',
      bucket,
      key: cleanKey,
      clientOverride,
    });

    const headers = res.headers || {};
    const size = parseInt(headers['content-length'] || '0', 10);
    const targetBucket = bucket || this.defaultBucket;

    return {
      ok: true,
      provider: 'aws_s3',
      bucket: targetBucket,
      key: cleanKey,
      filename: cleanKey.split('/').pop(),
      size,
      sizeFormatted: formatBytes(size),
      contentType: headers['content-type'] || getMimeType(cleanKey),
      etag: headers.etag || '',
      modifiedAt: headers['last-modified'] || new Date().toISOString(),
    };
  }
}

module.exports = S3StorageProvider;


/**
 * StorageNode Unit Tests
 * Covers:
 *   - Node metadata and registration
 *   - Validation rules for Local and AWS S3 storage
 *   - Local storage operations (upload, download, list, delete, get_metadata)
 *   - AWS S3 operations with mocked REST responses (upload, download, list, delete, get_metadata)
 *   - File reference object inheritance between steps
 *   - SigV4 signing verification and headers
 *   - Rate limit (503 / 429) backoff retries
 *   - Secret redaction of AWS credentials
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const StorageNode = require('../nodes/StorageNode');
const ExecutionContext = require('../utils/ExecutionContext');
const ConnectionService = require('../services/ConnectionService');
const { NodeTypes } = require('../constants');
const { getStorageRoot } = require('../utils/FileSecurity');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting StorageNode Unit Tests...\n');

  const storageNode = new StorageNode();
  const storageRoot = getStorageRoot();
  const testSubdir = path.join(storageRoot, 'test_storage_node');
  if (!fs.existsSync(testSubdir)) fs.mkdirSync(testSubdir, { recursive: true });

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-s3-test') {
      return {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        bucket: 'workflow-archive-bucket',
      };
    }
    throw new Error('Connection not found');
  };

  try {
    // ── 1. Metadata & Registration ───────────────────────────────────────────
    console.log('Test Group 1: Node Metadata');
    check(storageNode.type === NodeTypes.ACTION_STORAGE, 'StorageNode: type matches NodeTypes.ACTION_STORAGE');
    check(storageNode.name === 'Storage Operations', 'StorageNode: name is Storage Operations');
    check(storageNode.category === 'action', 'StorageNode: category is action');
    check(storageNode.icon === 'Cloud', 'StorageNode: icon is Cloud');

    // ── 2. Validation ────────────────────────────────────────────────────────
    console.log('\nTest Group 2: Validation');

    // Missing key for upload
    const noKeyUpload = storageNode.validate({ data: { provider: 'local', operation: 'upload', content: 'test' } });
    check(noKeyUpload.valid === false && noKeyUpload.error.includes('key or path is required'), 'StorageNode: rejects upload missing key');

    // Missing content for upload
    const noContentUpload = storageNode.validate({ data: { provider: 'local', operation: 'upload', key: 'data.txt' } });
    check(noContentUpload.valid === false && noContentUpload.error.includes('Content or file reference is required'), 'StorageNode: rejects upload missing content');

    // S3 missing credentials
    const noCredsS3 = storageNode.validate({ data: { provider: 'aws_s3', operation: 'upload', key: 'data.txt', content: 'test' } });
    check(noCredsS3.valid === false && noCredsS3.error.includes('AWS S3 connection or Access Key credentials are required'), 'StorageNode: rejects S3 without connection or keys');

    // Valid configurations
    const validLocal = storageNode.validate({ data: { provider: 'local', operation: 'upload', key: 'backup.json', content: '{}' } });
    check(validLocal.valid === true, 'StorageNode: validates valid local upload');

    const validS3 = storageNode.validate({ data: { provider: 'aws_s3', connectionId: 'conn-1', operation: 'upload', key: 'backup.json', content: '{}' } });
    check(validS3.valid === true, 'StorageNode: validates valid S3 upload with connectionId');

    const validList = storageNode.validate({ data: { provider: 'local', operation: 'list' } });
    check(validList.valid === true, 'StorageNode: validates valid list operation');

    // ── 3. Local Storage Operations ──────────────────────────────────────────
    console.log('\nTest Group 3: Local Storage Operations');

    const ctx = new ExecutionContext();
    ctx.setResult('step_trigger', {
      reportMonth: '2026-10',
      datasetName: 'payroll_summary',
    });

    // Upload to local storage
    const localUploadNode = {
      id: 'local-upload',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'local',
        operation: 'upload',
        key: 'test_storage_node/{{ step_trigger.datasetName }}_{{ step_trigger.reportMonth }}.json',
        content: '{"month":"{{ step_trigger.reportMonth }}","employees":450}',
        format: 'json',
      },
    };

    const localUploadRes = await storageNode.execute(localUploadNode, ctx);
    check(localUploadRes.ok === true, 'StorageNode: local upload succeeds');
    check(localUploadRes.key.includes('payroll_summary_2026-10.json'), 'StorageNode: resolves variables in storage key');
    check(localUploadRes.contentType === 'application/json', 'StorageNode: sets JSON content-type');

    // Download from local storage
    const localDownloadNode = {
      id: 'local-download',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'local',
        operation: 'download',
        key: 'test_storage_node/payroll_summary_2026-10.json',
        format: 'json',
      },
    };

    const localDownloadRes = await storageNode.execute(localDownloadNode, ctx);
    check(localDownloadRes.ok === true, 'StorageNode: local download succeeds');
    check(localDownloadRes.content.month === '2026-10', 'StorageNode: download parses JSON content');
    check(localDownloadRes.content.employees === 450, 'StorageNode: preserves number in JSON download');

    // List local files
    const localListNode = {
      id: 'local-list',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'local',
        operation: 'list',
        prefix: 'test_storage_node/',
      },
    };

    const localListRes = await storageNode.execute(localListNode, ctx);
    check(localListRes.ok === true, 'StorageNode: local list succeeds');
    check(Array.isArray(localListRes.files) && localListRes.files.length >= 1, 'StorageNode: list returns files array');
    check(localListRes.files.some((f) => f.key.includes('payroll_summary')), 'StorageNode: list includes uploaded file');

    // Get Metadata
    const localMetaNode = {
      id: 'local-meta',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'local',
        operation: 'get_metadata',
        key: 'test_storage_node/payroll_summary_2026-10.json',
      },
    };

    const localMetaRes = await storageNode.execute(localMetaNode, ctx);
    check(localMetaRes.ok === true, 'StorageNode: local get_metadata succeeds');
    check(localMetaRes.size > 0, 'StorageNode: metadata reports positive size');
    check(Boolean(localMetaRes.etag), 'StorageNode: metadata reports etag');

    // Delete local file
    const localDelNode = {
      id: 'local-del',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'local',
        operation: 'delete',
        key: 'test_storage_node/payroll_summary_2026-10.json',
      },
    };

    const localDelRes = await storageNode.execute(localDelNode, ctx);
    check(localDelRes.ok === true && localDelRes.deleted === true, 'StorageNode: local delete succeeds');

    // ── 4. AWS S3 Operations (Mocked REST Responses) ─────────────────────────
    console.log('\nTest Group 4: AWS S3 Operations (Mocked)');

    let s3CapturedRequests = [];
    const mockS3Client = async (config) => {
      s3CapturedRequests.push(config);

      // Handle PUT (Upload)
      if (config.method === 'PUT') {
        return {
          status: 200,
          headers: {
            etag: '"b10a8db164e0754105b7a99be72e3fe5"',
          },
          data: Buffer.alloc(0),
        };
      }

      // Handle GET (Download file or List objects)
      if (config.method === 'GET') {
        // If list query
        if (config.url.includes('list-type=2')) {
          const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Name>workflow-archive-bucket</Name>
    <Prefix>exports/</Prefix>
    <KeyCount>2</KeyCount>
    <MaxKeys>100</MaxKeys>
    <IsTruncated>false</IsTruncated>
    <Contents>
        <Key>exports/monthly_report.csv</Key>
        <LastModified>2026-10-30T10:00:00.000Z</LastModified>
        <ETag>&quot;3a5c7e8b9d0e1f2a3b4c5d6e7f8a9b0c&quot;</ETag>
        <Size>4096</Size>
    </Contents>
    <Contents>
        <Key>exports/audit_log.json</Key>
        <LastModified>2026-10-30T11:00:00.000Z</LastModified>
        <ETag>&quot;4b6d8f9a0e1f2a3b4c5d6e7f8a9b0c1d&quot;</ETag>
        <Size>2048</Size>
    </Contents>
</ListBucketResult>`;
          return {
            status: 200,
            headers: { 'content-type': 'application/xml' },
            data: Buffer.from(mockXml),
          };
        }

        // Normal file download
        const downloadedText = 'customer_id,name,plan\nC-100,Acme Corp,Enterprise\nC-101,Beta Ltd,Pro';
        return {
          status: 200,
          headers: {
            'content-type': 'text/csv',
            etag: '"3a5c7e8b9d0e1f2a3b4c5d6e7f8a9b0c"',
            'last-modified': '2026-10-30T10:00:00.000Z',
          },
          data: Buffer.from(downloadedText),
        };
      }

      // Handle HEAD (Metadata)
      if (config.method === 'HEAD') {
        return {
          status: 200,
          headers: {
            'content-length': '4096',
            'content-type': 'text/csv',
            etag: '"3a5c7e8b9d0e1f2a3b4c5d6e7f8a9b0c"',
            'last-modified': '2026-10-30T10:00:00.000Z',
          },
          data: Buffer.alloc(0),
        };
      }

      // Handle DELETE
      if (config.method === 'DELETE') {
        return {
          status: 204,
          headers: {},
          data: Buffer.alloc(0),
        };
      }

      throw new Error(`Unexpected S3 request method: ${config.method}`);
    };

    // 4A: S3 Upload
    const s3UploadNode = {
      id: 's3-upload',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'upload',
        key: 'exports/monthly_report.csv',
        content: 'customer_id,name,plan\nC-100,Acme Corp,Enterprise',
        format: 'csv',
      },
    };

    const s3UploadRes = await storageNode.execute(s3UploadNode, ctx, { _s3Client: mockS3Client });
    check(s3UploadRes.ok === true, 'StorageNode: S3 upload succeeds');
    check(s3UploadRes.provider === 'aws_s3', 'StorageNode: reports provider = aws_s3');
    check(s3UploadRes.bucket === 'workflow-archive-bucket', 'StorageNode: uses connection default bucket');
    check(s3UploadRes.etag.includes('b10a8db164e0754105b7a99be72e3fe5'), 'StorageNode: returns S3 etag');
    check(s3UploadRes.url.includes('workflow-archive-bucket.s3.us-east-1.amazonaws.com/exports/monthly_report.csv'), 'StorageNode: generates S3 object URL');

    // Verify SigV4 header on S3 request
    const putReq = s3CapturedRequests[0];
    check(Boolean(putReq.headers.Authorization), 'S3StorageProvider: attaches Authorization header');
    check(putReq.headers.Authorization.startsWith('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE'), 'S3StorageProvider: signs with AWS4-HMAC-SHA256 and AccessKey');
    check(Boolean(putReq.headers['x-amz-date']), 'S3StorageProvider: attaches x-amz-date header');
    check(Boolean(putReq.headers['x-amz-content-sha256']), 'S3StorageProvider: calculates SHA256 of payload');

    // 4B: S3 Download
    const s3DownloadNode = {
      id: 's3-download',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'download',
        key: 'exports/monthly_report.csv',
        format: 'csv',
      },
    };

    const s3DownloadRes = await storageNode.execute(s3DownloadNode, ctx, { _s3Client: mockS3Client });
    check(s3DownloadRes.ok === true, 'StorageNode: S3 download succeeds');
    check(s3DownloadRes.$type === 'file_reference', 'StorageNode: S3 download returns file_reference');
    check(Array.isArray(s3DownloadRes.content) && s3DownloadRes.content.length === 2, 'StorageNode: parses downloaded CSV into records');
    check(s3DownloadRes.content[0].name === 'Acme Corp', 'StorageNode: extracts record from downloaded CSV');

    // 4C: S3 List Objects
    const s3ListNode = {
      id: 's3-list',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'list',
        prefix: 'exports/',
      },
    };

    const s3ListRes = await storageNode.execute(s3ListNode, ctx, { _s3Client: mockS3Client });
    check(s3ListRes.ok === true, 'StorageNode: S3 list succeeds');
    check(s3ListRes.files.length === 2, 'StorageNode: S3 list parses 2 objects from XML');
    check(s3ListRes.files[0].key === 'exports/monthly_report.csv', 'StorageNode: extracts key from S3 listing');
    check(s3ListRes.files[1].size === 2048, 'StorageNode: extracts object size from S3 listing');

    // 4D: S3 Get Metadata
    const s3MetaNode = {
      id: 's3-meta',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'get_metadata',
        key: 'exports/monthly_report.csv',
      },
    };

    const s3MetaRes = await storageNode.execute(s3MetaNode, ctx, { _s3Client: mockS3Client });
    check(s3MetaRes.ok === true, 'StorageNode: S3 get_metadata succeeds');
    check(s3MetaRes.size === 4096, 'StorageNode: extracts size from HEAD headers');
    check(s3MetaRes.contentType === 'text/csv', 'StorageNode: extracts content-type from HEAD headers');

    // 4E: S3 Delete
    const s3DelNode = {
      id: 's3-delete',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'delete',
        key: 'exports/monthly_report.csv',
      },
    };

    const s3DelRes = await storageNode.execute(s3DelNode, ctx, { _s3Client: mockS3Client });
    check(s3DelRes.ok === true && s3DelRes.deleted === true, 'StorageNode: S3 delete succeeds');

    // ── 5. File Reference Passing Between Nodes ──────────────────────────────
    console.log('\nTest Group 5: File Reference Passing Between Steps');

    // Pass a complete file reference object into upload
    ctx.setResult('file_gen_step', {
      $type: 'file_reference',
      filename: 'generated_data.json',
      path: 'data/generated_data.json',
      mimeType: 'application/json',
      format: 'json',
      content: { generated: true, version: 2 },
    });

    const fileRefUploadNode = {
      id: 's3-file-ref-upload',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'upload',
        key: 'incoming/imported_ref.json',
        content: '{{ steps.file_gen_step }}',
      },
    };

    const fileRefRes = await storageNode.execute(fileRefUploadNode, ctx, { _s3Client: mockS3Client });
    check(fileRefRes.ok === true, 'StorageNode: successfully ingests file reference object from prior step');

    // ── 6. Rate Limit (HTTP 503 SlowDown) Backoff & Secret Redaction ─────────
    console.log('\nTest Group 6: Rate Limiting & Secret Redaction');

    let s3Attempts = 0;
    const retryS3Client = async (config) => {
      s3Attempts++;
      if (s3Attempts < 2) {
        const err = new Error('SlowDown');
        err.response = { status: 503, data: '<Error><Code>SlowDown</Code></Error>' };
        throw err;
      }
      return {
        status: 200,
        headers: { etag: '"retry-etag"' },
        data: Buffer.alloc(0),
      };
    };

    const retryUploadNode = {
      id: 's3-retry',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-test',
        operation: 'upload',
        key: 'retry.txt',
        content: 'Retry payload',
      },
    };

    const retryRes = await storageNode.execute(retryUploadNode, ctx, { _s3Client: retryS3Client });
    check(retryRes.ok === true, 'StorageNode: S3 retries and recovers from HTTP 503 SlowDown');
    check(s3Attempts === 2, 'StorageNode: retried after 503 backoff');

    // Secret redaction on S3 failure
    const failingS3Client = async () => {
      const err = new Error('SignatureDoesNotMatch: calculated with secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY for key AKIAIOSFODNN7EXAMPLE');
      err.response = { status: 403, data: 'SignatureDoesNotMatch' };
      throw err;
    };

    let caughtS3Err = null;
    try {
      await storageNode.execute({
        id: 's3-fail',
        type: NodeTypes.ACTION_STORAGE,
        data: {
          provider: 'aws_s3',
          connectionId: 'conn-s3-test',
          operation: 'upload',
          key: 'fail.txt',
          content: 'fail',
        },
      }, ctx, { _s3Client: failingS3Client });
    } catch (err) {
      caughtS3Err = err;
    }

    check(Boolean(caughtS3Err), 'StorageNode: throws NodeExecutionError on S3 failure');
    check(!caughtS3Err.message.includes('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'), 'StorageNode: redacts secretAccessKey from error message');
    check(!caughtS3Err.message.includes('AKIAIOSFODNN7EXAMPLE'), 'StorageNode: redacts accessKeyId from error message');

  } finally {
    ConnectionService.getDecryptedCredentials = originalGetCreds;
    if (fs.existsSync(testSubdir)) {
      try { fs.rmSync(testSubdir, { recursive: true, force: true }); } catch {}
    }
  }

  console.log(`\nStorageNode Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('StorageNode test failed:', err);
  process.exit(1);
});


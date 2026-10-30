/**
 * Frontend File & Storage Node Configuration & Validation Unit Tests
 * Covers:
 *   - action-file validation rules in NodeValidator
 *   - action-storage validation rules in NodeValidator
 *   - DefaultNodeData defaults for File and Storage nodes
 *   - Icon mapping and resolution (HardDrive, Cloud)
 *   - Palette definitions in NODE_DEFS
 */

import NodeValidator from '../validators/NodeValidator.js';
import { NodeTypes } from '../constants/NodeTypes.js';
import DefaultNodeData from '../constants/DefaultNodeData.js';
import { getNodeIcon, getProviderIcon } from '../constants/Icons.js';
import { NODE_DEFS } from '../data/templates.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function main() {
  console.log('\n🧪 Starting Frontend File & Storage Node Validation Unit Tests...\n');

  // ── Group 1: File Node Validation ──────────────────────────────────────────
  console.log('Group 1: File Node Validation (action-file)');

  // 1. Valid read_file
  const validReadFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'read_file',
      path: 'data/input.csv',
      format: 'csv',
    },
  };
  assert(NodeValidator.validateNode(validReadFile).valid === true, 'File: validates valid read_file');

  // 2. Missing path on read_file
  const missingPathReadFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'read_file',
      format: 'text',
    },
  };
  const missingPathRes = NodeValidator.validateNode(missingPathReadFile);
  assert(
    missingPathRes.valid === false && missingPathRes.error?.includes('File path or filename is required'),
    'File: rejects read_file with missing path'
  );

  // 3. Valid write_file
  const validWriteFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'write_file',
      path: 'output/report.json',
      format: 'json',
      content: { success: true },
    },
  };
  assert(NodeValidator.validateNode(validWriteFile).valid === true, 'File: validates valid write_file');

  // 4. Missing content on write_file
  const missingContentWriteFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'write_file',
      path: 'output/empty.txt',
    },
  };
  const missingContentRes = NodeValidator.validateNode(missingContentWriteFile);
  assert(
    missingContentRes.valid === false && missingContentRes.error?.includes('Content is required for Write File'),
    'File: rejects write_file missing content'
  );

  // 5. Valid create_file
  const validCreateFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'create_file',
      path: 'logs/execution.log',
    },
  };
  assert(NodeValidator.validateNode(validCreateFile).valid === true, 'File: validates valid create_file');

  // 6. Valid delete_file
  const validDeleteFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'delete_file',
      path: 'temp/old.csv',
    },
  };
  assert(NodeValidator.validateNode(validDeleteFile).valid === true, 'File: validates valid delete_file');

  // 7. Valid get_metadata
  const validMetadataFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'get_metadata',
      path: 'archive/data.zip',
    },
  };
  assert(NodeValidator.validateNode(validMetadataFile).valid === true, 'File: validates valid get_metadata');

  // 8. Valid move_file
  const validMoveFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'move_file',
      sourcePath: 'inbox/file.txt',
      destinationPath: 'archive/file.txt',
    },
  };
  assert(NodeValidator.validateNode(validMoveFile).valid === true, 'File: validates valid move_file');

  // 9. Move file missing destination
  const missingDestMove = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'move_file',
      sourcePath: 'inbox/file.txt',
    },
  };
  const missingDestRes = NodeValidator.validateNode(missingDestMove);
  assert(
    missingDestRes.valid === false && missingDestRes.error?.includes('Destination file path is required'),
    'File: rejects move_file missing destination'
  );

  // 10. Invalid operation
  const invalidOpFile = {
    type: NodeTypes.ACTION_FILE,
    data: {
      operation: 'launch_missile',
      path: 'file.txt',
    },
  };
  const invalidOpRes = NodeValidator.validateNode(invalidOpFile);
  assert(
    invalidOpRes.valid === false && invalidOpRes.error?.includes('Invalid operation "launch_missile"'),
    'File: rejects invalid file operation'
  );

  // ── Group 2: Storage Node Validation ───────────────────────────────────────
  console.log('\nGroup 2: Storage Node Validation (action-storage)');

  // 1. Valid local upload
  const validLocalUpload = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'upload',
      key: 'uploads/avatar.png',
      content: 'base64-content',
    },
  };
  assert(NodeValidator.validateNode(validLocalUpload).valid === true, 'Storage: validates valid local upload');

  // 2. Valid S3 upload with connectionId
  const validS3UploadConn = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'aws_s3',
      connectionId: 'conn-s3-1',
      operation: 'upload',
      key: 'backups/db.tar.gz',
      content: 'blob',
    },
  };
  assert(NodeValidator.validateNode(validS3UploadConn).valid === true, 'Storage: validates S3 upload with connectionId');

  // 3. Valid S3 upload with inline credentials
  const validS3UploadCreds = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'aws_s3',
      accessKeyId: 'AKIA1234567890',
      secretAccessKey: 'secret-key-123',
      operation: 'upload',
      key: 'backups/db.tar.gz',
      content: 'blob',
    },
  };
  assert(NodeValidator.validateNode(validS3UploadCreds).valid === true, 'Storage: validates S3 upload with inline credentials');

  // 4. Missing S3 credentials
  const missingS3Creds = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'aws_s3',
      operation: 'upload',
      key: 'backups/db.tar.gz',
      content: 'blob',
    },
  };
  const missingS3CredsRes = NodeValidator.validateNode(missingS3Creds);
  assert(
    missingS3CredsRes.valid === false && missingS3CredsRes.error?.includes('AWS S3 connection or Access Key credentials are required'),
    'Storage: rejects S3 operation without credentials or connection'
  );

  // 5. Missing key on upload
  const missingKeyUpload = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'upload',
      content: 'data',
    },
  };
  const missingKeyRes = NodeValidator.validateNode(missingKeyUpload);
  assert(
    missingKeyRes.valid === false && missingKeyRes.error?.includes('Storage key or path is required for Upload'),
    'Storage: rejects upload missing key'
  );

  // 6. Missing content on upload
  const missingContentUpload = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'upload',
      key: 'reports/empty.txt',
    },
  };
  const missingContentUploadRes = NodeValidator.validateNode(missingContentUpload);
  assert(
    missingContentUploadRes.valid === false && missingContentUploadRes.error?.includes('Content or file reference is required for Upload'),
    'Storage: rejects upload missing content'
  );

  // 7. Valid download
  const validDownload = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'download',
      key: 'reports/sales.csv',
    },
  };
  assert(NodeValidator.validateNode(validDownload).valid === true, 'Storage: validates valid download');

  // 8. Missing key on download
  const missingKeyDownload = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'download',
    },
  };
  const missingKeyDownloadRes = NodeValidator.validateNode(missingKeyDownload);
  assert(
    missingKeyDownloadRes.valid === false && missingKeyDownloadRes.error?.includes('Storage key is required for download'),
    'Storage: rejects download missing key'
  );

  // 9. Valid list operation (key not required)
  const validList = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'list',
      prefix: 'reports/',
    },
  };
  assert(NodeValidator.validateNode(validList).valid === true, 'Storage: validates list without key');

  // 10. Valid get_metadata
  const validStorageMetadata = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'get_metadata',
      key: 'archive/dataset.csv',
    },
  };
  assert(NodeValidator.validateNode(validStorageMetadata).valid === true, 'Storage: validates get_metadata');

  // 11. Valid delete
  const validStorageDelete = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      provider: 'local',
      operation: 'delete',
      key: 'temp/cache.json',
    },
  };
  assert(NodeValidator.validateNode(validStorageDelete).valid === true, 'Storage: validates delete');

  // 12. Invalid storage operation
  const invalidOpStorage = {
    type: NodeTypes.ACTION_STORAGE,
    data: {
      operation: 'format_drive',
      key: 'danger',
    },
  };
  const invalidOpStorageRes = NodeValidator.validateNode(invalidOpStorage);
  assert(
    invalidOpStorageRes.valid === false && invalidOpStorageRes.error?.includes('Invalid operation "format_drive"'),
    'Storage: rejects invalid storage operation'
  );

  // ── Group 3: DefaultNodeData Defaults ──────────────────────────────────────
  console.log('\nGroup 3: DefaultNodeData Defaults');

  const fileDefaults = DefaultNodeData[NodeTypes.ACTION_FILE];
  assert(Boolean(fileDefaults), 'DefaultNodeData defines ACTION_FILE');
  assert(fileDefaults?.label === 'File Operations', 'File default label is "File Operations"');
  assert(fileDefaults?.operation === 'read_file', 'File default operation is "read_file"');
  assert(fileDefaults?.format === 'text', 'File default format is "text"');
  assert(fileDefaults?.overwrite === true, 'File default overwrite is true');

  const storageDefaults = DefaultNodeData[NodeTypes.ACTION_STORAGE];
  assert(Boolean(storageDefaults), 'DefaultNodeData defines ACTION_STORAGE');
  assert(storageDefaults?.label === 'Storage Operations', 'Storage default label is "Storage Operations"');
  assert(storageDefaults?.provider === 'local', 'Storage default provider is "local"');
  assert(storageDefaults?.operation === 'upload', 'Storage default operation is "upload"');
  assert(storageDefaults?.format === 'text', 'Storage default format is "text"');

  // ── Group 4: Icon Mapping ──────────────────────────────────────────────────
  console.log('\nGroup 4: Icon Mapping');

  const fileIcon = getNodeIcon(NodeTypes.ACTION_FILE);
  assert(Boolean(fileIcon), 'getNodeIcon returns icon for action-file');

  const storageIcon = getNodeIcon(NodeTypes.ACTION_STORAGE);
  assert(Boolean(storageIcon), 'getNodeIcon returns icon for action-storage');

  const s3ProviderIcon = getProviderIcon('aws_s3');
  assert(Boolean(s3ProviderIcon), 'getProviderIcon returns icon for aws_s3');

  const s3ShortProviderIcon = getProviderIcon('s3');
  assert(Boolean(s3ShortProviderIcon), 'getProviderIcon returns icon for s3');

  // ── Group 5: Palette Definitions in NODE_DEFS ──────────────────────────────
  console.log('\nGroup 5: Palette Definitions in NODE_DEFS');

  const fileDef = NODE_DEFS[NodeTypes.ACTION_FILE];
  assert(Boolean(fileDef), 'NODE_DEFS contains action-file');
  assert(fileDef?.label === 'File Operations', 'action-file palette label is File Operations');
  assert(fileDef?.category === 'action', 'action-file palette category is action');
  assert(fileDef?.icon === 'HardDrive', 'action-file palette icon is HardDrive');

  const storageDef = NODE_DEFS[NodeTypes.ACTION_STORAGE];
  assert(Boolean(storageDef), 'NODE_DEFS contains action-storage');
  assert(storageDef?.label === 'Storage', 'action-storage palette label is Storage');
  assert(storageDef?.category === 'action', 'action-storage palette category is action');
  assert(storageDef?.icon === 'Cloud', 'action-storage palette icon is Cloud');

  console.log(`\nFrontend File & Storage Node Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();

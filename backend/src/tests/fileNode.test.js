/**
 * FileNode Unit Tests
 * Covers:
 *   - Node metadata and registration
 *   - Validation rules for all operations
 *   - Operations: create_file, write_file, read_file, get_metadata, move_file, delete_file
 *   - Format support: text, JSON, CSV, binary
 *   - Append and overwrite modes
 *   - Path traversal prevention during execution
 *   - Variable interpolation in paths and content
 *   - Secret redaction and error handling
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const FileNode = require('../nodes/FileNode');
const ExecutionContext = require('../utils/ExecutionContext');
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
  console.log('\n🧪 Starting FileNode Unit Tests...\n');

  const fileNode = new FileNode();
  const storageRoot = getStorageRoot();
  const testSubdir = path.join(storageRoot, 'test_file_node');
  if (!fs.existsSync(testSubdir)) fs.mkdirSync(testSubdir, { recursive: true });

  try {
    // ── 1. Metadata ──────────────────────────────────────────────────────────
    console.log('Test Group 1: Node Metadata');
    check(fileNode.type === NodeTypes.ACTION_FILE, 'FileNode: type matches NodeTypes.ACTION_FILE');
    check(fileNode.name === 'File Operations', 'FileNode: name is File Operations');
    check(fileNode.category === 'action', 'FileNode: category is action');
    check(fileNode.icon === 'HardDrive', 'FileNode: icon is HardDrive');

    // ── 2. Validation ────────────────────────────────────────────────────────
    console.log('\nTest Group 2: Validation');

    // Missing path
    const noPath = fileNode.validate({ data: { operation: 'read_file' } });
    check(noPath.valid === false && noPath.error.includes('required'), 'FileNode: rejects read_file with missing path');

    // Invalid operation
    const badOp = fileNode.validate({ data: { operation: 'wipe_hard_drive', path: 'file.txt' } });
    check(badOp.valid === false && badOp.error.includes('Invalid operation'), 'FileNode: rejects invalid operation');

    // write_file: missing content
    const noContent = fileNode.validate({ data: { operation: 'write_file', path: 'file.txt' } });
    check(noContent.valid === false && noContent.error.includes('Content is required'), 'FileNode: rejects write_file with missing content');

    // move_file: missing destination
    const noDest = fileNode.validate({ data: { operation: 'move_file', path: 'src.txt' } });
    check(noDest.valid === false && noDest.error.includes('Destination file path is required'), 'FileNode: rejects move_file with missing destination');

    // Valid configurations
    check(fileNode.validate({ data: { operation: 'read_file', path: 'data.txt' } }).valid === true, 'FileNode: validates valid read_file');
    check(fileNode.validate({ data: { operation: 'write_file', path: 'data.txt', content: 'Hello' } }).valid === true, 'FileNode: validates valid write_file');
    check(fileNode.validate({ data: { operation: 'create_file', path: 'empty.txt' } }).valid === true, 'FileNode: validates valid create_file');
    check(fileNode.validate({ data: { operation: 'delete_file', path: 'old.txt' } }).valid === true, 'FileNode: validates valid delete_file');
    check(fileNode.validate({ data: { operation: 'get_metadata', path: 'info.txt' } }).valid === true, 'FileNode: validates valid get_metadata');
    check(fileNode.validate({ data: { operation: 'move_file', sourcePath: 'a.txt', destinationPath: 'b.txt' } }).valid === true, 'FileNode: validates valid move_file');

    // ── 3. Operations: write_file and read_file (Text, JSON, CSV, Binary) ─────
    console.log('\nTest Group 3: Operations write_file and read_file');

    const ctx = new ExecutionContext();
    ctx.setResult('prev_step', {
      orderId: 'ORD-9876',
      total: 129.99,
      customer: 'Diana Prince',
    });

    // 3A: Text Write & Read
    const textWriteNode = {
      id: 'file-text-write',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/greeting.txt',
        content: 'Hello, {{ prev_step.customer }}! Order: {{ prev_step.orderId }}',
        format: 'text',
      },
    };
    const textWriteRes = await fileNode.execute(textWriteNode, ctx);
    check(textWriteRes.ok === true, 'FileNode: text write_file succeeds');
    check(textWriteRes.bytesWritten > 0, 'FileNode: reports bytesWritten');
    check(textWriteRes.$type === 'file_reference', 'FileNode: write returns file_reference');

    const textReadNode = {
      id: 'file-text-read',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: 'test_file_node/greeting.txt',
        format: 'text',
      },
    };
    const textReadRes = await fileNode.execute(textReadNode, ctx);
    check(textReadRes.ok === true, 'FileNode: text read_file succeeds');
    check(textReadRes.content === 'Hello, Diana Prince! Order: ORD-9876', 'FileNode: resolves variables in written text and reads back');

    // 3B: JSON Write & Read
    const jsonWriteNode = {
      id: 'file-json-write',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/order.json',
        content: '{"orderId":"{{ prev_step.orderId }}","total":{{ prev_step.total }}}',
        format: 'json',
      },
    };
    const jsonWriteRes = await fileNode.execute(jsonWriteNode, ctx);
    check(jsonWriteRes.ok === true, 'FileNode: JSON write_file succeeds');
    check(jsonWriteRes.mimeType === 'application/json', 'FileNode: assigns application/json MIME type');

    const jsonReadNode = {
      id: 'file-json-read',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: 'test_file_node/order.json',
        format: 'json',
      },
    };
    const jsonReadRes = await fileNode.execute(jsonReadNode, ctx);
    check(jsonReadRes.ok === true, 'FileNode: JSON read_file succeeds');
    check(typeof jsonReadRes.content === 'object', 'FileNode: parses JSON content into an object');
    check(jsonReadRes.content.orderId === 'ORD-9876', 'FileNode: extracts parsed JSON property');
    check(jsonReadRes.content.total === 129.99, 'FileNode: parses numeric JSON field');

    // 3C: CSV Write & Read
    const csvWriteNode = {
      id: 'file-csv-write',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/inventory.csv',
        content: 'sku,name,qty\nSKU-1,Laptop,15\nSKU-2,Monitor,42',
        format: 'csv',
      },
    };
    await fileNode.execute(csvWriteNode, ctx);

    const csvReadNode = {
      id: 'file-csv-read',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: 'test_file_node/inventory.csv',
        format: 'csv',
      },
    };
    const csvReadRes = await fileNode.execute(csvReadNode, ctx);
    check(csvReadRes.ok === true, 'FileNode: CSV read_file succeeds');
    check(Array.isArray(csvReadRes.content) && csvReadRes.content.length === 2, 'FileNode: parses CSV rows into object array');
    check(csvReadRes.content[0].name === 'Laptop', 'FileNode: extracts first CSV row name');
    check(csvReadRes.content[1].qty === '42', 'FileNode: extracts second CSV row qty');

    // 3D: Binary (Base64) Write & Read
    const base64Data = Buffer.from('Binary Test Data 12345').toString('base64');
    const binWriteNode = {
      id: 'file-bin-write',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/raw.bin',
        content: base64Data,
        format: 'binary',
        encoding: 'base64',
      },
    };
    await fileNode.execute(binWriteNode, ctx);

    const binReadNode = {
      id: 'file-bin-read',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: 'test_file_node/raw.bin',
        format: 'binary',
      },
    };
    const binReadRes = await fileNode.execute(binReadNode, ctx);
    check(binReadRes.ok === true, 'FileNode: binary read_file succeeds');
    check(binReadRes.encoding === 'base64', 'FileNode: binary read returns base64 encoding');
    check(binReadRes.content === base64Data, 'FileNode: binary round-trip preserves exact base64 content');

    // ── 4. Append Mode & Create File ─────────────────────────────────────────
    console.log('\nTest Group 4: Append Mode & Create File');

    const appendNode = {
      id: 'file-append',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/log.txt',
        content: 'Line 1\n',
        format: 'text',
      },
    };
    await fileNode.execute(appendNode, ctx);

    const appendNode2 = {
      id: 'file-append-2',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'test_file_node/log.txt',
        content: 'Line 2\n',
        format: 'text',
        append: true,
      },
    };
    await fileNode.execute(appendNode2, ctx);

    const readLog = await fileNode.execute({
      id: 'read-log',
      type: NodeTypes.ACTION_FILE,
      data: { operation: 'read_file', path: 'test_file_node/log.txt' },
    }, ctx);
    check(readLog.content === 'Line 1\nLine 2\n', 'FileNode: append mode appends to existing content');

    // create_file
    const createRes = await fileNode.execute({
      id: 'create-node',
      type: NodeTypes.ACTION_FILE,
      data: { operation: 'create_file', path: 'test_file_node/new_created.txt', initialContent: 'Initialized' },
    }, ctx);
    check(createRes.ok === true && createRes.created === true, 'FileNode: create_file succeeds');

    // ── 5. Metadata, Move, and Delete ─────────────────────────────────────────
    console.log('\nTest Group 5: Metadata, Move, and Delete');

    // get_metadata
    const metaRes = await fileNode.execute({
      id: 'meta-node',
      type: NodeTypes.ACTION_FILE,
      data: { operation: 'get_metadata', path: 'test_file_node/greeting.txt' },
    }, ctx);
    check(metaRes.ok === true, 'FileNode: get_metadata succeeds');
    check(metaRes.filename === 'greeting.txt', 'FileNode: metadata contains filename');
    check(metaRes.size > 0, 'FileNode: metadata contains size');
    check(metaRes.mimeType === 'text/plain', 'FileNode: metadata contains MIME type');

    // move_file
    const moveRes = await fileNode.execute({
      id: 'move-node',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'move_file',
        sourcePath: 'test_file_node/greeting.txt',
        destinationPath: 'test_file_node/greeting_renamed.txt',
      },
    }, ctx);
    check(moveRes.ok === true, 'FileNode: move_file succeeds');
    check(moveRes.filename === 'greeting_renamed.txt', 'FileNode: move updates destination filename');
    check(fs.existsSync(path.join(storageRoot, 'test_file_node', 'greeting_renamed.txt')), 'FileNode: new file exists on disk');
    check(!fs.existsSync(path.join(storageRoot, 'test_file_node', 'greeting.txt')), 'FileNode: old file removed from disk');

    // delete_file
    const deleteRes = await fileNode.execute({
      id: 'del-node',
      type: NodeTypes.ACTION_FILE,
      data: { operation: 'delete_file', path: 'test_file_node/greeting_renamed.txt' },
    }, ctx);
    check(deleteRes.ok === true && deleteRes.deleted === true, 'FileNode: delete_file succeeds');
    check(!fs.existsSync(path.join(storageRoot, 'test_file_node', 'greeting_renamed.txt')), 'FileNode: deleted file removed from disk');

    // delete_file ignore missing
    const delMissing = await fileNode.execute({
      id: 'del-missing',
      type: NodeTypes.ACTION_FILE,
      data: { operation: 'delete_file', path: 'test_file_node/non_existent.txt', ignoreMissing: true },
    }, ctx);
    check(delMissing.ok === true && delMissing.deleted === false, 'FileNode: delete_file handles ignoreMissing');

    // ── 6. Path Traversal Security Protection ────────────────────────────────
    console.log('\nTest Group 6: Path Traversal Security');

    let traversalCaught = false;
    try {
      await fileNode.execute({
        id: 'traversal-attack',
        type: NodeTypes.ACTION_FILE,
        data: { operation: 'read_file', path: '../../../../Windows/System32/drivers/etc/hosts' },
      }, ctx);
    } catch (err) {
      traversalCaught = err.message.includes('Path traversal');
    }
    check(traversalCaught, 'FileNode: blocks execution on path traversal attempt');

  } finally {
    // Clean up test directory
    if (fs.existsSync(testSubdir)) {
      try { fs.rmSync(testSubdir, { recursive: true, force: true }); } catch {}
    }
  }

  console.log(`\nFileNode Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('FileNode test failed:', err);
  process.exit(1);
});


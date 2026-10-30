/**
 * FileSecurity Unit Tests
 * Covers:
 *   - Path traversal prevention & safe resolution
 *   - Storage root confinement
 *   - MIME type detection
 *   - Format conversions (text, JSON, CSV, binary)
 *   - Standard file reference formatting
 *   - File size validation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
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
} = require('../utils/FileSecurity');

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
  console.log('\n🧪 Starting FileSecurity Unit Tests...\n');

  // ── 1. Storage Root & Safe Path Resolution ─────────────────────────────────
  console.log('Test Group 1: Path Traversal Prevention & Containment');

  const storageRoot = getStorageRoot();
  check(Boolean(storageRoot), 'getStorageRoot: returns valid root directory');
  check(fs.existsSync(storageRoot), 'getStorageRoot: creates directory if it does not exist');

  // Valid relative paths
  const safePath1 = resolveSafePath('reports/monthly.csv');
  check(safePath1.startsWith(storageRoot), 'resolveSafePath: confines relative path to storageRoot');
  check(safePath1.endsWith(path.join('reports', 'monthly.csv')), 'resolveSafePath: preserves subdirectory and filename');

  const safePath2 = resolveSafePath('plain-file.txt');
  check(safePath2.startsWith(storageRoot), 'resolveSafePath: confines root-level file');

  // Path traversal attacks (must be rejected)
  let traversalRejected1 = false;
  try {
    resolveSafePath('../../etc/passwd');
  } catch (err) {
    traversalRejected1 = err.message.includes('Path traversal attempt rejected');
  }
  check(traversalRejected1, 'resolveSafePath: rejects ../ path traversal');

  let traversalRejected2 = false;
  try {
    resolveSafePath('reports/../../../Windows/System32');
  } catch (err) {
    traversalRejected2 = err.message.includes('Path traversal attempt rejected');
  }
  check(traversalRejected2, 'resolveSafePath: rejects nested ../ path traversal');

  // Null byte injection
  let nullByteRejected = false;
  try {
    resolveSafePath('file.txt\0.exe');
  } catch (err) {
    nullByteRejected = err.message.includes('Null bytes are not permitted');
  }
  check(nullByteRejected, 'resolveSafePath: rejects null byte injection');

  // UNC network paths
  let uncRejected = false;
  try {
    resolveSafePath('\\\\evil-server\\share\\file.txt');
  } catch (err) {
    uncRejected = err.message.includes('UNC network paths are not permitted');
  }
  check(uncRejected, 'resolveSafePath: rejects UNC network paths');

  // Empty / whitespace path
  let emptyRejected = false;
  try {
    resolveSafePath('   ');
  } catch (err) {
    emptyRejected = err.message.includes('required');
  }
  check(emptyRejected, 'resolveSafePath: rejects empty path');

  // ── 2. MIME Type Detection & Size Formatting ──────────────────────────────
  console.log('\nTest Group 2: MIME Type Detection & Size Formatting');

  check(getMimeType('data.json') === 'application/json', 'getMimeType: recognizes .json');
  check(getMimeType('export.csv') === 'text/csv', 'getMimeType: recognizes .csv');
  check(getMimeType('notes.txt') === 'text/plain', 'getMimeType: recognizes .txt');
  check(getMimeType('image.png') === 'image/png', 'getMimeType: recognizes .png');
  check(getMimeType('archive.zip') === 'application/zip', 'getMimeType: recognizes .zip');
  check(getMimeType('document.pdf') === 'application/pdf', 'getMimeType: recognizes .pdf');
  check(getMimeType('unknown.customext') === 'application/octet-stream', 'getMimeType: falls back to octet-stream');

  check(formatBytes(0) === '0 B', 'formatBytes: 0 bytes');
  check(formatBytes(512) === '512 B', 'formatBytes: 512 bytes');
  check(formatBytes(1024) === '1 KB', 'formatBytes: 1024 bytes -> 1 KB');
  check(formatBytes(1048576) === '1 MB', 'formatBytes: 1048576 bytes -> 1 MB');
  check(formatBytes(1572864) === '1.5 MB', 'formatBytes: 1.5 MB formatted');

  // ── 3. CSV Parsing & Serialization ─────────────────────────────────────────
  console.log('\nTest Group 3: CSV Parsing & Serialization');

  const sampleCsv = `id,name,role\n1,Alice,Engineer\n2,"Bob, Jr.",Designer`;
  const parsedRows = parseCsv(sampleCsv);
  check(Array.isArray(parsedRows) && parsedRows.length === 2, 'parseCsv: parses 2 records');
  check(parsedRows[0].name === 'Alice', 'parseCsv: extracts unquoted value');
  check(parsedRows[1].name === 'Bob, Jr.', 'parseCsv: handles quotes with commas');

  const serialized = serializeCsv(parsedRows);
  check(serialized.includes('id,name,role'), 'serializeCsv: includes header row');
  check(serialized.includes('"Bob, Jr."'), 'serializeCsv: escapes cell with comma');

  // ── 4. Format Conversions (Text, JSON, Binary) ─────────────────────────────
  console.log('\nTest Group 4: Format Conversions');

  // JSON format
  const jsonBuf = Buffer.from('{"status":"OK","code":200}', 'utf8');
  const parsedJson = parseContent(jsonBuf, 'json');
  check(parsedJson.content.status === 'OK', 'parseContent: parses JSON buffer to object');
  check(parsedJson.content.code === 200, 'parseContent: preserves numbers in JSON');

  // Binary (Base64) format
  const binaryBuf = Buffer.from([0x00, 0x01, 0x02, 0xff]);
  const parsedBinary = parseContent(binaryBuf, 'binary');
  check(parsedBinary.encoding === 'base64', 'parseContent: sets base64 encoding');
  check(typeof parsedBinary.content === 'string', 'parseContent: content is base64 string');
  const roundTripBuf = serializeContent(parsedBinary.content, 'binary', 'base64');
  check(Buffer.compare(binaryBuf, roundTripBuf) === 0, 'serializeContent: round-trips binary buffer');

  // Standard File Reference structure
  const tempTestFile = path.join(storageRoot, 'unit_test_ref.txt');
  fs.writeFileSync(tempTestFile, 'Sample file content for reference test');
  try {
    const stats = fs.statSync(tempTestFile);
    const ref = buildFileReference(tempTestFile, stats, 'Sample file content for reference test', 'text');
    check(ref.$type === 'file_reference', 'buildFileReference: sets $type = file_reference');
    check(ref.filename === 'unit_test_ref.txt', 'buildFileReference: includes filename');
    check(ref.mimeType === 'text/plain', 'buildFileReference: sets correct mimeType');
    check(ref.size > 0, 'buildFileReference: includes positive size');
    check(ref.sizeFormatted.includes('B'), 'buildFileReference: includes human-readable size');
    check(Boolean(ref.createdAt) && Boolean(ref.modifiedAt), 'buildFileReference: includes timestamps');
  } finally {
    if (fs.existsSync(tempTestFile)) fs.unlinkSync(tempTestFile);
  }

  console.log(`\nFileSecurity Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('FileSecurity test failed:', err);
  process.exit(1);
});


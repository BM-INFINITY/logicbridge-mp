/**
 * S3 Connection & Provider Unit Tests
 * Covers:
 *   - Provider registration in ConnectionRegistry
 *   - Metadata, icons, required fields
 *   - Verification with valid, invalid, and empty credentials
 *   - Credential encryption and secret redaction
 */

const assert = require('assert');
const { connectionRegistry } = require('../providers/connections/ConnectionRegistry');
const S3ConnectionProvider = require('../providers/connections/S3ConnectionProvider');
const CredentialService = require('../services/CredentialService');
const { redactSecrets } = require('../utils/SecretRedactor');

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
  console.log('\n🧪 Starting S3 Connection Unit Tests...\n');

  // ── 1. Provider Registration ──────────────────────────────────────────────
  console.log('Test Group 1: Provider Registration');

  const provider = connectionRegistry.resolve('aws_s3');
  check(Boolean(provider), 'ConnectionRegistry: aws_s3 provider is registered');
  check(provider.id === 'aws_s3', 'ConnectionRegistry: provider ID is aws_s3');
  check(provider.name === 'AWS S3', 'ConnectionRegistry: provider name is AWS S3');
  check(provider.category === 'storage', 'ConnectionRegistry: provider category is storage');
  check(provider.supportsVerification === true, 'ConnectionRegistry: supportsVerification is true');
  check(Array.isArray(provider.requiredFields), 'ConnectionRegistry: requiredFields is an array');

  // Alias checks
  const s3Alias = connectionRegistry.resolve('s3');
  check(Boolean(s3Alias) && s3Alias.id === 'aws_s3', 'ConnectionRegistry: s3 alias resolves to aws_s3');
  const awsS3Alias = connectionRegistry.resolve('aws-s3');
  check(Boolean(awsS3Alias) && awsS3Alias.id === 'aws_s3', 'ConnectionRegistry: aws-s3 alias resolves to aws_s3');

  // Required field checks
  const accessKeyField = provider.requiredFields.find((f) => f.key === 'accessKeyId');
  check(Boolean(accessKeyField) && accessKeyField.required === true, 'ConnectionRegistry: accessKeyId field is required');
  const secretKeyField = provider.requiredFields.find((f) => f.key === 'secretAccessKey');
  check(Boolean(secretKeyField) && secretKeyField.type === 'password', 'ConnectionRegistry: secretAccessKey is password type');

  // Instance methods
  const s3Instance = new S3ConnectionProvider();
  check(typeof s3Instance.verify === 'function', 'S3ConnectionProvider: has verify method');
  check(typeof s3Instance.verifyCredentials === 'function', 'S3ConnectionProvider: has verifyCredentials method');
  check(typeof s3Instance.disconnect === 'function', 'S3ConnectionProvider: has disconnect method');

  // ── 2. Verification Logic ─────────────────────────────────────────────────
  console.log('\nTest Group 2: Verification Logic');

  // Missing accessKeyId
  const emptyRes = await s3Instance.verify({});
  check(emptyRes.ok === false && emptyRes.message.includes('Access Key ID is required'), 'S3ConnectionProvider: rejects missing accessKeyId');

  // Missing secretAccessKey
  const noSecretRes = await s3Instance.verify({ accessKeyId: 'AKIAIOSFODNN7EXAMPLE' });
  check(noSecretRes.ok === false && noSecretRes.message.includes('Secret Access Key is required'), 'S3ConnectionProvider: rejects missing secretAccessKey');

  // Successful verification via mock result
  const mockSuccessRes = await s3Instance.verify({
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-west-2',
    bucket: 'prod-backups',
    _mockAuthResult: {
      ok: true,
      message: 'Connected to AWS S3 bucket "prod-backups" in region "us-west-2"',
    },
  });
  check(mockSuccessRes.ok === true, 'S3ConnectionProvider: verifies valid S3 credentials via mock');
  check(mockSuccessRes.region === 'us-west-2', 'S3ConnectionProvider: returns region metadata');
  check(mockSuccessRes.bucket === 'prod-backups', 'S3ConnectionProvider: returns bucket metadata');

  // Error result via mock
  const mockFailRes = await s3Instance.verify({
    accessKeyId: 'AKIA_REVOKED',
    secretAccessKey: 'invalid-secret',
    _mockAuthResult: new Error('The AWS Access Key Id you provided does not exist in our records.'),
  });
  check(mockFailRes.ok === false, 'S3ConnectionProvider: handles S3 auth failure');
  check(mockFailRes.message.includes('does not exist'), 'S3ConnectionProvider: returns clean error explanation');

  // ── 3. Credential Encryption & Redaction ──────────────────────────────────
  console.log('\nTest Group 3: Credential Encryption & Secret Redaction');

  const rawSecretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const encrypted = CredentialService.encrypt(rawSecretKey);
  check(encrypted !== rawSecretKey, 'CredentialService: encrypts S3 secretAccessKey');
  const decrypted = CredentialService.decrypt(encrypted);
  check(decrypted === rawSecretKey, 'CredentialService: decrypts S3 secretAccessKey correctly');

  // Redaction of AWS keys in log strings
  const logStr = 'Connecting to S3 with accessKey AKIAIOSFODNN7EXAMPLE and secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY Signature=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const redactedStr = redactSecrets(logStr);
  check(!redactedStr.includes('AKIAIOSFODNN7EXAMPLE'), 'SecretRedactor: masks AKIA Access Key ID in strings');
  check(!redactedStr.includes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'), 'SecretRedactor: masks AWS SigV4 Signature string');
  check(redactedStr.includes('[REDACTED]'), 'SecretRedactor: inserts [REDACTED] placeholder');

  // Redaction in credential objects
  const credsObj = {
    region: 'us-east-1',
    bucket: 'my-bucket',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'FwoGZXIvYXdz...tempToken',
  };
  const redactedObj = redactSecrets(credsObj);
  check(redactedObj.accessKeyId === '[REDACTED]', 'SecretRedactor: redacts accessKeyId key');
  check(redactedObj.secretAccessKey === '[REDACTED]', 'SecretRedactor: redacts secretAccessKey key');
  check(redactedObj.sessionToken === '[REDACTED]', 'SecretRedactor: redacts sessionToken key');
  check(redactedObj.region === 'us-east-1', 'SecretRedactor: preserves non-sensitive region');
  check(redactedObj.bucket === 'my-bucket', 'SecretRedactor: preserves non-sensitive bucket');

  console.log(`\nS3 Connection Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('S3 Connection test failed:', err);
  process.exit(1);
});


/**
 * securityRemediationPhase2.test.js
 *
 * Comprehensive Security Regression & Remediation Test Suite (Iteration 43 — Phase 2):
 *
 * SEC-08: Authentication Rate Limiting & Brute-Force Defense
 * SEC-09: JWT Lifecycle, Refresh-Token Rotation, Reuse Detection & Revocation
 * SEC-10: User Roles, Privilege Escalation Prevention & Authorization
 * SEC-11 & Part B.4: Filesystem Symlink, Path Security, Owner Isolation & TOCTOU
 * SEC-12: Internal Error Disclosure Prevention & Path Sanitization
 * SEC-13: Webhook HMAC Security (MD5/SHA-1 rejection & SHA-2 validation)
 * SEC-14: Transform Node Prototype Pollution Defense
 * Part B.1: SSRF Socket Lookup & Redirect Verification
 * Part B.2: Self-Hosted AI Endpoint Allowlisting (ALLOWED_PRIVATE_AI_HOSTS)
 * Part B.3: OAuth State Durability & Browser Session Binding
 * Part B.5: Credential Encryption Key Strength & Shannon Entropy
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Core Utilities & Services
const {
  loginRateLimiter,
  registerRateLimiter,
  recordFailure,
  recordLoginSuccess,
  resetRateLimits,
} = require('../middleware/rateLimiter');
const { userService } = require('../services');
const { protect, requireRole } = require('../middleware/authMiddleware');
const errorHandler = require('../middleware/errorHandler');
const ResponseHelper = require('../utils/ResponseHelper');
const { webhookService } = require('../services');
const TransformNode = require('../nodes/TransformNode');
const NetworkSecurity = require('../utils/NetworkSecurity');
const OAuthService = require('../utils/../services/OAuthService');
const FileSecurity = require('../utils/FileSecurity');
const LocalStorageProvider = require('../providers/storage/LocalStorageProvider');
const CredentialService = require('../services/CredentialService');
const authValidator = require('../validators/authValidator');
const User = require('../models/User');
const ExecutionContext = require('../utils/ExecutionContext');
const { NodeTypes, WorkflowStatus } = require('../constants');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function it(label, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAIL: ${label}`);
    console.error(`     ${err.message}`);
  }
}

async function itAsync(label, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAIL: ${label}`);
    console.error(`     ${err.message}`);
  }
}

async function assertRejects(fn, expectedSubstring, label) {
  totalTests++;
  try {
    await fn();
    failedTests++;
    console.error(`  ❌ FAIL: ${label} (Expected rejection containing "${expectedSubstring}", but succeeded)`);
  } catch (err) {
    if (expectedSubstring && !err.message.includes(expectedSubstring)) {
      failedTests++;
      console.error(`  ❌ FAIL: ${label} (Expected "${expectedSubstring}", got "${err.message}")`);
    } else {
      passedTests++;
      console.log(`  ✅ ${label}`);
    }
  }
}

// Mock helper to create Express req/res/next stubs
function createMockReqRes({ ip = '127.0.0.1', body = {}, headers = {}, params = {}, query = {}, user = null } = {}) {
  const req = {
    ip,
    body,
    headers,
    params,
    query,
    user,
    method: 'POST',
    url: '/api/auth/test',
    connection: { remoteAddress: ip },
  };

  const res = {
    statusCode: 200,
    headersSent: false,
    _headers: {},
    _json: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, val) {
      this._headers[name.toLowerCase()] = val;
      return this;
    },
    json(data) {
      this._json = data;
      this.headersSent = true;
      return this;
    },
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err) => {
    nextCalled = true;
    nextError = err || null;
  };

  return { req, res, next, wasNextCalled: () => nextCalled, getNextError: () => nextError };
}

async function runPhase2SecurityTests() {
  console.log('\n🔒 Starting Iteration 43 — Phase 2: Security Hardening Implementation Tests...\n');

  // Mock WebhookEvent and WorkflowEngine to avoid Mongoose buffering in standalone test runs
  try {
    const WebhookEvent = require('../models/WebhookEvent');
    if (WebhookEvent) {
      WebhookEvent.create = async () => ({ _id: 'mock_evt_id' });
      WebhookEvent.findOne = async () => null;
      WebhookEvent.findOneAndUpdate = async () => null;
      WebhookEvent.updateOne = async () => ({});
    }
  } catch {}
  webhookService.recordEvent = async () => ({ _id: 'mock_evt_id' });
  const workflowEngine = require('../services/workflowEngine');
  workflowEngine.run = async () => ({ _id: 'mock_exec_id', status: 'success' });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-08: Authentication Rate Limiting & Brute-Force Defense
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Group 1: SEC-08: Authentication Rate Limiting & Account Protection');

  resetRateLimits();

  // Test IP-based rate limiting: 5 failed attempts allowed, 6th is rejected
  const clientIp = '198.51.100.1';
  for (let i = 0; i < 5; i++) {
    const { req, res, next, wasNextCalled } = createMockReqRes({ ip: clientIp, body: { email: 'user@example.com' } });
    loginRateLimiter(req, res, next);
    assert.strictEqual(wasNextCalled(), true, `Attempt ${i + 1} should be allowed through`);
    recordFailure(clientIp, 'user@example.com');
  }

  // 6th attempt from the same IP should be blocked with HTTP 429
  const blockedReqRes = createMockReqRes({ ip: clientIp, body: { email: 'user@example.com' } });
  loginRateLimiter(blockedReqRes.req, blockedReqRes.res, blockedReqRes.next);
  it('RateLimiter: Blocks 6th failed login attempt from same IP with HTTP 429', () => {
    assert.strictEqual(blockedReqRes.res.statusCode, 429);
    assert.strictEqual(blockedReqRes.res._headers['retry-after'] !== undefined, true);
    assert.strictEqual(blockedReqRes.res._json.code, 'RATE_LIMIT_EXCEEDED');
  });

  // Test account-based rate limiting across distinct IPs
  resetRateLimits();
  const targetEmail = 'ceo@company.com';
  for (let i = 0; i < 5; i++) {
    const ip = `198.51.100.${10 + i}`;
    const { req, res, next, wasNextCalled } = createMockReqRes({ ip, body: { email: targetEmail } });
    loginRateLimiter(req, res, next);
    assert.strictEqual(wasNextCalled(), true);
    recordFailure(ip, targetEmail);
  }

  // 6th attempt targeting the same account from a new IP should be blocked
  const distributedReqRes = createMockReqRes({ ip: '198.51.100.99', body: { email: targetEmail } });
  loginRateLimiter(distributedReqRes.req, distributedReqRes.res, distributedReqRes.next);
  it('RateLimiter: Blocks distributed brute-force targeting same account across different IPs', () => {
    assert.strictEqual(distributedReqRes.res.statusCode, 429);
    assert.strictEqual(distributedReqRes.res._json.message.includes('account'), true);
  });

  // Test success reset: recordLoginSuccess clears counters
  recordLoginSuccess('198.51.100.1', targetEmail);
  const resetReqRes = createMockReqRes({ ip: '198.51.100.1', body: { email: targetEmail } });
  loginRateLimiter(resetReqRes.req, resetReqRes.res, resetReqRes.next);
  it('RateLimiter: Successful login resets rate-limit counters', () => {
    assert.strictEqual(resetReqRes.wasNextCalled(), true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-09: JWT Lifecycle, Refresh-Token Rotation, Reuse Detection & Revocation
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 2: SEC-09: JWT Token Lifecycle, Rotation & Reuse Detection');

  // Test access token generation
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Alice Security',
    email: 'alice@example.com',
    role: 'user',
    tokenVersion: 0,
  };

  const accessToken = userService.generateAccessToken(mockUser);
  it('UserService: Generates valid JWT access token with role and tokenVersion', () => {
    assert.strictEqual(typeof accessToken, 'string');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(accessToken);
    assert.strictEqual(decoded.id, mockUser._id);
    assert.strictEqual(decoded.role, 'user');
    assert.strictEqual(decoded.tokenVersion, 0);
  });

  // Issue refresh token
  const refreshToken1 = await userService.issueRefreshToken(mockUser);
  it('UserService: Issues cryptographically random 64-char hex refresh token', () => {
    assert.strictEqual(typeof refreshToken1, 'string');
    assert.strictEqual(refreshToken1.length, 64);
  });

  // Mock User.findById for refresh/protect tests
  const origFindById = User.findById;
  User.findById = (id) => ({
    select: () => Promise.resolve({
      _id: id,
      name: 'Alice Security',
      email: 'alice@example.com',
      role: 'user',
      tokenVersion: 0,
    }),
  });

  // Refresh token rotation
  const rotated = await userService.refreshUserToken({ refreshToken: refreshToken1 });
  it('UserService: Successfully rotates refresh token and issues new access token', () => {
    assert.strictEqual(typeof rotated.accessToken, 'string');
    assert.strictEqual(typeof rotated.refreshToken, 'string');
    assert.notStrictEqual(rotated.refreshToken, refreshToken1);
  });

  // REUSE DETECTION: Attacker or victim replays the old refreshToken1
  await assertRejects(
    () => userService.refreshUserToken({ refreshToken: refreshToken1 }),
    'Security Alert: Compromised refresh token reuse detected',
    'UserService: Replaying rotated refresh token triggers reuse detection and revokes family'
  );

  // Subsequent use of rotated.refreshToken must now also fail because family was revoked!
  await assertRejects(
    () => userService.refreshUserToken({ refreshToken: rotated.refreshToken }),
    'Security Alert: Compromised refresh token reuse detected',
    'UserService: Entire token family is invalidated after token reuse attempt'
  );

  // Session revocation via tokenVersion
  User.findById = (id) => ({
    select: () => Promise.resolve({
      _id: id,
      name: 'Alice Security',
      email: 'alice@example.com',
      role: 'user',
      tokenVersion: 1, // User revoked all sessions!
    }),
  });

  const { req: revReq, res: revRes, next: revNext } = createMockReqRes({
    headers: { authorization: `Bearer ${accessToken}` }, // Has tokenVersion: 0
  });

  await protect(revReq, revRes, revNext);
  it('AuthMiddleware: Rejects access token whose tokenVersion is older than user.tokenVersion', () => {
    assert.strictEqual(revRes.statusCode, 401);
    assert.strictEqual(revRes._json.message.includes('revoked'), true);
  });

  User.findById = origFindById;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-10: User Roles & Privilege Escalation Prevention
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 3: SEC-10: User Roles & Privilege Escalation Prevention');

  // Attacker attempts to register as admin via registration payload
  const privilegeAttempt = authValidator.validateRegister({
    name: 'Evil Admin',
    email: 'evil@example.com',
    password: 'password123',
    role: 'admin',
  });

  it('AuthValidator: Rejects registration payload specifying role: "admin"', () => {
    assert.strictEqual(privilegeAttempt.valid, false);
    assert.strictEqual(privilegeAttempt.error.includes('Privilege escalation rejected'), true);
  });

  // Role authorization middleware tests
  const adminUser = { _id: 'admin_1', role: 'admin' };
  const standardUser = { _id: 'user_1', role: 'user' };
  const approverUser = { _id: 'approver_1', role: 'approver' };

  // Admin access to admin route
  const adminReq = createMockReqRes({ user: adminUser });
  requireRole('admin')(adminReq.req, adminReq.res, adminReq.next);
  it('requireRole: Permits admin user on admin route', () => {
    assert.strictEqual(adminReq.wasNextCalled(), true);
  });

  // Standard user access to admin route
  const userAdminReq = createMockReqRes({ user: standardUser });
  requireRole('admin')(userAdminReq.req, userAdminReq.res, userAdminReq.next);
  it('requireRole: Blocks standard user on admin route with HTTP 403', () => {
    assert.strictEqual(userAdminReq.res.statusCode, 403);
    assert.strictEqual(userAdminReq.res._json.message.includes('Forbidden'), true);
  });

  // Approver user access to approver/admin route
  const approverReq = createMockReqRes({ user: approverUser });
  requireRole('admin', 'approver')(approverReq.req, approverReq.res, approverReq.next);
  it('requireRole: Permits approver user on multi-role [admin, approver] route', () => {
    assert.strictEqual(approverReq.wasNextCalled(), true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-11 & Part B.4: Filesystem Symlink, Owner Isolation & TOCTOU
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 4: SEC-11 & Part B.4: Filesystem Symlink, Owner Isolation & TOCTOU');

  const testPhase2Storage = path.resolve(process.cwd(), 'data', 'test_sandbox_phase2');
  if (!fs.existsSync(testPhase2Storage)) {
    fs.mkdirSync(testPhase2Storage, { recursive: true });
  }

  // 1. Owner-less access to user storage namespace is strictly forbidden
  await assertRejects(
    () => FileSecurity.resolveSafePath('users/victim_user/confidential.txt', { baseDir: testPhase2Storage }),
    'Security Error: Access to user storage namespace requires an authenticated ownerId',
    'FileSecurity: Forbids owner-less operations from resolving into users/ namespace'
  );

  // 2. Invalid or malicious ownerId rejected
  await assertRejects(
    () => FileSecurity.resolveSafePath('report.txt', { baseDir: testPhase2Storage, ownerId: '../../../' }),
    'Security Error: Invalid ownerId provided',
    'FileSecurity: Rejects malicious ownerId containing directory traversal sequences'
  );

  // 3. User upload containment and post-write symlink TOCTOU verification
  const phase2Storage = new LocalStorageProvider({ storageRoot: testPhase2Storage });
  const uploadRes = await phase2Storage.upload({
    key: 'safe_document.txt',
    content: 'Sensitive user content',
    ownerId: 'user_david_1',
  });

  it('LocalStorageProvider: Upload verifies realpath matches user storage root', () => {
    assert.strictEqual(uploadRes.ok, true);
    const expectedDiskPath = path.resolve(testPhase2Storage, 'users', 'user_david_1', 'safe_document.txt');
    assert.strictEqual(fs.existsSync(expectedDiskPath), true);
  });

  // Clean up test folder
  try {
    fs.rmSync(testPhase2Storage, { recursive: true, force: true });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-12: Internal Error Disclosure Prevention & Path Sanitization
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 5: SEC-12: Internal Error Disclosure Prevention & Sanitization');

  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    // Simulate an unhandled database exception with path and stack
    const dbError = new Error('MongoError: failed to connect to server [mongodb+srv://admin:p@ssword@cluster0.net/prod] at C:\\logicbridge\\backend\\src\\db.js:42');
    dbError.statusCode = 500;
    dbError.stack = 'Error: MongoError...\n    at C:\\logicbridge\\backend\\src\\db.js:42:15';

    const { req: errReq, res: errRes, next: errNext } = createMockReqRes();
    errorHandler(dbError, errReq, errRes, errNext);

    it('ErrorHandler in production: Hides internal 500 error messages and stacks', () => {
      assert.strictEqual(errRes.statusCode, 500);
      assert.strictEqual(errRes._json.message, 'An internal server error occurred');
      assert.strictEqual(errRes._json.code, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(errRes._json.stack, undefined);
      assert.strictEqual(typeof errRes._json.errorId, 'string');
    });

    // Simulate 400 error containing accidental local filesystem path
    const pathError = new Error('File not found at D:\\logicbridge-mp\\data\\storage\\users\\secret.csv');
    pathError.statusCode = 400;

    const { req: pathReq, res: pathRes, next: pathNext } = createMockReqRes();
    errorHandler(pathError, pathReq, pathRes, pathNext);

    it('ErrorHandler: Sanitizes local filesystem paths from 4xx client-facing messages', () => {
      assert.strictEqual(pathRes.statusCode, 400);
      assert.strictEqual(pathRes._json.message.includes('D:\\logicbridge-mp'), false);
      assert.strictEqual(pathRes._json.message.includes('[REDACTED_PATH]'), true);
    });

    // Test ResponseHelper.error in production
    const { res: helperRes } = createMockReqRes();
    ResponseHelper.error(helperRes, 'Internal database crash details: secret key sk-12345678901234567890 failed', 500);
    it('ResponseHelper in production: Masks 500 error messages to generic internal server error', () => {
      assert.strictEqual(helperRes.statusCode, 500);
      assert.strictEqual(helperRes._json.message, 'An internal server error occurred');
    });
  } finally {
    process.env.NODE_ENV = origEnv;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-13: Webhook HMAC Security
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 6: SEC-13: Webhook HMAC Security & Weak Algorithm Rejection');

  const webhookWorkflow = {
    _id: '507f191e810c19729de860f1',
    status: WorkflowStatus.ACTIVE,
    nodes: [
      {
        id: 'node_webhook',
        type: NodeTypes.TRIGGER_WEBHOOK,
        data: {
          enabled: true,
          authType: 'hmac',
          hmacAlgorithm: 'md5', // INSECURE ALGORITHM!
          hmacSecret: 'my_webhook_secret',
        },
      },
    ],
  };

  const md5Req = {
    method: 'POST',
    url: '/api/webhooks/inbound/507f191e810c19729de860f1',
    headers: { 'x-hub-signature-256': 'd41d8cd98f00b204e9800998ecf8427e' },
    body: { test: true },
    ip: '127.0.0.1',
  };

  // 1. MD5 rejected
  const md5Result = await webhookService.processWebhook(webhookWorkflow, md5Req);
  it('WebhookService: Explicitly rejects insecure MD5 HMAC algorithm with HTTP 400', () => {
    assert.strictEqual(md5Result.status, 400);
    assert.strictEqual(md5Result.body.error.includes('Insecure HMAC algorithm'), true);
  });

  // 2. SHA-1 rejected
  webhookWorkflow.nodes[0].data.hmacAlgorithm = 'sha1';
  const sha1Result = await webhookService.processWebhook(webhookWorkflow, md5Req);
  it('WebhookService: Explicitly rejects insecure SHA-1 HMAC algorithm with HTTP 400', () => {
    assert.strictEqual(sha1Result.status, 400);
    assert.strictEqual(sha1Result.body.error.includes('Insecure HMAC algorithm'), true);
  });

  // 3. SHA-256 accepted
  webhookWorkflow.nodes[0].data.hmacAlgorithm = 'sha256';
  const secret = 'my_webhook_secret';
  const rawBody = JSON.stringify({ event: 'payment.success' });
  const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sha256Req = {
    method: 'POST',
    url: '/api/webhooks/inbound/507f191e810c19729de860f1',
    headers: { 'x-hub-signature-256': `sha256=${validSig}` },
    body: JSON.parse(rawBody),
    rawBody: Buffer.from(rawBody),
    ip: '127.0.0.1',
  };

  const sha256Result = await webhookService.processWebhook(webhookWorkflow, sha256Req);
  it('WebhookService: Accepts secure SHA-256 HMAC signature', () => {
    assert.strictEqual(sha256Result.status, 200);
    assert.strictEqual(sha256Result.body.status, 'success');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEC-14: Transform Node Prototype Pollution Defense
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 7: SEC-14: Transform Node Prototype Pollution Defense');

  const transformNode = new TransformNode();

  // 1. Validation blocks __proto__ mapping outputField
  const protoValidation = transformNode.validate({
    id: 't1',
    data: {
      operation: 'map',
      mappings: [{ outputField: '__proto__', source: '{{ trigger.body.evil }}' }],
    },
  });
  it('TransformNode: Rejects __proto__ outputField in validate()', () => {
    assert.strictEqual(protoValidation.valid, false);
    assert.strictEqual(protoValidation.error.includes('Prototype pollution rejected'), true);
  });

  // 2. Validation blocks constructor mapping outputField
  const constrValidation = transformNode.validate({
    id: 't2',
    data: {
      operation: 'map',
      mappings: [{ outputField: 'constructor', source: '{{ trigger.body.evil }}' }],
    },
  });
  it('TransformNode: Rejects constructor outputField in validate()', () => {
    assert.strictEqual(constrValidation.valid, false);
    assert.strictEqual(constrValidation.error.includes('Prototype pollution rejected'), true);
  });

  // 3. Validation blocks nested prototype pollution path (e.g. __proto__.polluted)
  const nestedValidation = transformNode.validate({
    id: 't3',
    data: {
      operation: 'set',
      mappings: [{ outputField: 'user.__proto__.admin', source: 'true' }],
    },
  });
  it('TransformNode: Rejects nested path user.__proto__.admin in validate()', () => {
    assert.strictEqual(nestedValidation.valid, false);
    assert.strictEqual(nestedValidation.error.includes('Prototype pollution rejected'), true);
  });

  // 4. Execution-time enforcement: Even if validation was bypassed, execute() blocks pollution
  const execContext = new ExecutionContext({ lastOutput: { role: 'guest' } });
  await assertRejects(
    () =>
      transformNode.execute(
        {
          id: 't4',
          data: {
            operation: 'set',
            mappings: [{ outputField: '__proto__', source: '{"polluted": true}' }],
          },
        },
        execContext
      ),
    'Prototype pollution rejected',
    'TransformNode: Runtime execution strictly intercepts and aborts prototype pollution attempt'
  );

  // 5. Legitimate nested field transformations continue working cleanly
  const legitRes = await transformNode.execute(
    {
      id: 't5',
      data: {
        operation: 'map',
        mappings: [
          { outputField: 'user.profile.name', source: 'Alice' },
          { outputField: 'user.profile.role', source: 'developer' },
        ],
      },
    },
    execContext
  );

  it('TransformNode: Legitimate nested property mapping works cleanly', () => {
    assert.strictEqual(legitRes.data.user.profile.name, 'Alice');
    assert.strictEqual(legitRes.data.user.profile.role, 'developer');
  });

  // 6. Global assertion: Object.prototype remains unpolluted
  it('TransformNode: Object.prototype is verified completely unpolluted', () => {
    assert.strictEqual({}.polluted, undefined);
    assert.strictEqual({}.admin, undefined);
    assert.strictEqual(Object.prototype.polluted, undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Part B.1: SSRF Socket Lookup & Safe Agents
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 8: Part B.1: SSRF Socket Lookup & Safe Agents');

  const safeLookup = NetworkSecurity.createSafeLookup();

  // Test safeLookup with single address callback signature cb(null, address, family)
  const lookupResult = await new Promise((resolve, reject) => {
    safeLookup('example.com', {}, (err, address, family) => {
      if (err) reject(err);
      else resolve({ address, family });
    });
  });

  it('createSafeLookup: Resolves public host to validated IP', () => {
    assert.strictEqual(lookupResult !== null, true);
    assert.strictEqual(lookupResult.address, '93.184.216.34');
    assert.strictEqual(lookupResult.family, 4);
  });

  // Test safeLookup with { all: true } option
  const allLookupResult = await new Promise((resolve, reject) => {
    safeLookup('example.com', { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });

  it('createSafeLookup: Handles lookupOptions.all: true returning address array', () => {
    assert.strictEqual(Array.isArray(allLookupResult), true);
    assert.strictEqual(allLookupResult[0].address, '93.184.216.34');
  });

  // Test safeLookup blocks private IP lookup
  const blockedErr = await new Promise((resolve) => {
    safeLookup('127.0.0.1', {}, (err) => {
      resolve(err);
    });
  });

  it('createSafeLookup: Immediately intercepts socket lookup for 127.0.0.1', () => {
    assert.strictEqual(blockedErr !== null, true);
    assert.strictEqual(blockedErr.message.includes('SSRF blocked'), true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Part B.2: Self-Hosted AI Endpoint Allowlisting
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 9: Part B.2: Self-Hosted AI Endpoint Allowlisting');

  const savedHosts = process.env.ALLOWED_PRIVATE_AI_HOSTS;
  const savedAllowLocal = process.env.ALLOW_OLLAMA_LOCAL;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PRIVATE_AI_ENDPOINTS;

    // 1. With ALLOWED_PRIVATE_AI_HOSTS configured
    process.env.ALLOWED_PRIVATE_AI_HOSTS = 'ollama-worker.internal, 10.0.5.20';

    it('NetworkSecurity: Explicitly allowed AI host passes allowlist check', () => {
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('ollama-worker.internal', 'ollama'), true);
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('10.0.5.20', 'ollama'), true);
    });

    it('NetworkSecurity: Unlisted private IP is blocked despite being private', () => {
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('10.0.0.1', 'ollama'), false);
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('192.168.1.1', 'ollama'), false);
    });

    // 2. Cloud metadata is ALWAYS BLOCKED even if listed in ALLOWED_PRIVATE_AI_HOSTS
    process.env.ALLOWED_PRIVATE_AI_HOSTS = '169.254.169.254, metadata.google.internal';
    it('NetworkSecurity: Cloud metadata is strictly blocked even if mistakenly listed in allowlist', () => {
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('169.254.169.254', 'ollama'), false);
      assert.strictEqual(NetworkSecurity.isAllowedPrivateAiDestination('metadata.google.internal', 'ollama'), false);
    });
  } finally {
    process.env.ALLOWED_PRIVATE_AI_HOSTS = savedHosts;
    process.env.ALLOW_OLLAMA_LOCAL = savedAllowLocal;
    process.env.NODE_ENV = origEnv;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Part B.3: OAuth State Durability & Session Binding
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 10: Part B.3: OAuth State Durability & Browser Session Binding');

  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/oauth/google/callback';

  // 1. Generate auth URL with session binding
  const testSessionId = 'sess_xyz_987654';
  const boundAuthUrl = OAuthService.generateAuthUrl(
    'user_emily_1',
    'Emily Gmail',
    'gmail',
    { sessionId: testSessionId }
  );

  const boundState = new URL(boundAuthUrl).searchParams.get('state');

  // 2. Decode with matching session succeeds
  const decodedBound = OAuthService.decodeState(boundState, { sessionId: testSessionId });
  it('OAuthService: Validates state with matching browser session ID', () => {
    assert.strictEqual(decodedBound.userId, 'user_emily_1');
    assert.strictEqual(decodedBound.sessionId, testSessionId);
  });

  // 3. Decode with mismatched session is rejected
  const crossSessionUrl = OAuthService.generateAuthUrl(
    'user_emily_1',
    'Emily Gmail',
    'gmail',
    { sessionId: 'sess_original_111' }
  );
  const crossSessionState = new URL(crossSessionUrl).searchParams.get('state');

  assert.throws(
    () => OAuthService.decodeState(crossSessionState, { sessionId: 'sess_attacker_222' }),
    /session mismatch/i
  );
  it('OAuthService: Rejects state when incoming browser session does not match initiating session', () => {
    // Assert passed above
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Part B.5: Credential Encryption Key Strength & Shannon Entropy
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nGroup 11: Part B.5: Credential Encryption Key Entropy & Robustness');

  const origKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  try {
    process.env.NODE_ENV = 'production';

    // 1. 32-character key with zero entropy (repeated single character "aaaa...")
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(32);
    it('CredentialService in production: Rejects 32-char key with zero Shannon entropy', () => {
      assert.throws(
        () => CredentialService.getKey(),
        /lacks sufficient entropy/i
      );
    });

    // 2. 32-character key with predictable repeated sequence ("12341234...")
    process.env.CREDENTIAL_ENCRYPTION_KEY = '1234'.repeat(8);
    it('CredentialService in production: Rejects predictable repeated pattern key', () => {
      assert.throws(
        () => CredentialService.getKey(),
        /lacks sufficient entropy/i
      );
    });

    // 3. Cryptographically random high-entropy key succeeds
    const secureKey = crypto.randomBytes(32).toString('base64');
    process.env.CREDENTIAL_ENCRYPTION_KEY = secureKey;
    it('CredentialService in production: Accepts high-entropy cryptographically random key', () => {
      const derived = CredentialService.getKey();
      assert.strictEqual(Buffer.isBuffer(derived), true);
      assert.strictEqual(derived.length, 32);
      assert.strictEqual(CredentialService.calculateEntropy(secureKey) > 3.0, true);
    });

    // 4. Secret round-trip with high-entropy key
    const testSecret = { token: 'super-secret-auth-token', port: 5432 };
    const encrypted = CredentialService.encrypt(testSecret);
    const decrypted = CredentialService.decrypt(encrypted);
    it('CredentialService: Encrypt and decrypt round-trip succeeds with high-entropy key', () => {
      assert.deepStrictEqual(decrypted, testSecret);
    });
  } finally {
    process.env.CREDENTIAL_ENCRYPTION_KEY = origKey;
    process.env.NODE_ENV = origEnv;
  }

  console.log(`\nPhase 2 Security Tests Finished: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests.\n`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase2SecurityTests().catch((err) => {
  console.error('Unhandled Phase 2 test suite error:', err);
  process.exit(1);
});

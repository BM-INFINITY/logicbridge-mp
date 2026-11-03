/**
 * webhookSecurity.test.js
 *
 * Comprehensive tests for Webhook Management, Security, Reliability & Observability:
 * 1. HMAC signature generation and timing-safe verification (sha256, sha512, sha1)
 * 2. Rejection of invalid HMAC signatures and missing signature headers
 * 3. Timing-safe comparison preventing timing attacks
 * 4. Replay attack protection with timestamp verification and drift tolerance
 * 5. Payload size limits enforcement (413 Payload Too Large)
 * 6. Authentication modes: Bearer token, API Key (header/query), and Public (none)
 * 7. Event type filtering (matching vs ignored/rejected)
 * 8. Payload validation (required fields checking)
 * 9. Event deduplication using idempotency keys (prevents duplicate execution)
 * 10. Secret redaction in headers and body logging
 * 11. Safe historical event replay
 * 12. Endpoint enable/disable toggle enforcement
 */

const assert = require('assert');
const crypto = require('crypto');
const webhookService = require('../services/webhookService');
const WebhookEvent = require('../models/WebhookEvent');
const Workflow = require('../models/Workflow');
const workflowEngine = require('../services/workflowEngine');
const { NodeTypes, WorkflowStatus } = require('../constants');

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Advanced Webhook Management & Reliability Tests...\n');

  const testSecret = 'whsec_test_secret_key_789!@#';
  const testPayload = JSON.stringify({ event: 'order.created', id: 'ord_123', amount: 99.5 });

  // ── Group 1: HMAC Verification & Timing-Safe Comparison ───────────────────
  console.log('Group 1: HMAC Verification & Timing-Safe Comparison');
  {
    // Timing-safe comparison
    check('timingSafeCompare returns true for identical strings', webhookService.timingSafeCompare('secretA', 'secretA'));
    check('timingSafeCompare returns false for different content', !webhookService.timingSafeCompare('secretA', 'secretB'));
    check('timingSafeCompare returns false for different length without throwing', !webhookService.timingSafeCompare('short', 'much_longer_string'));
    check('timingSafeCompare handles non-string gracefully', !webhookService.timingSafeCompare(null, 'test'));

    // Valid HMAC SHA-256 with GitHub-style "sha256=" prefix
    const hmacSha256 = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');
    const reqValidSha256 = {
      headers: { 'x-hub-signature-256': `sha256=${hmacSha256}` },
      body: JSON.parse(testPayload),
    };
    const resSha256 = await webhookService.verifyAuthentication(
      {
        authType: 'hmac',
        hmacAlgorithm: 'sha256',
        hmacSecret: testSecret,
        hmacHeader: 'x-hub-signature-256',
        hmacPrefix: 'sha256=',
      },
      reqValidSha256,
      testPayload,
      'wf_test',
      'user_1'
    );
    check('Validates SHA-256 HMAC signature with prefix', resSha256.valid === true);

    // Valid HMAC SHA-512
    const hmacSha512 = crypto.createHmac('sha512', testSecret).update(testPayload).digest('hex');
    const reqValidSha512 = {
      headers: { 'x-signature-512': hmacSha512 },
      body: JSON.parse(testPayload),
    };
    const resSha512 = await webhookService.verifyAuthentication(
      {
        authType: 'hmac',
        hmacAlgorithm: 'sha512',
        hmacSecret: testSecret,
        hmacHeader: 'x-signature-512',
        hmacPrefix: '',
      },
      reqValidSha512,
      testPayload,
      'wf_test',
      'user_1'
    );
    check('Validates SHA-512 HMAC signature', resSha512.valid === true);

    // Tampered payload rejection
    const tamperedPayload = JSON.stringify({ event: 'order.created', id: 'ord_123', amount: 99999.0 });
    const resTampered = await webhookService.verifyAuthentication(
      {
        authType: 'hmac',
        hmacAlgorithm: 'sha256',
        hmacSecret: testSecret,
        hmacHeader: 'x-hub-signature-256',
        hmacPrefix: 'sha256=',
      },
      reqValidSha256,
      tamperedPayload,
      'wf_test',
      'user_1'
    );
    check('Rejects tampered payload with HMAC signature mismatch (401)', !resTampered.valid && resTampered.statusCode === 401);

    // Missing signature header
    const resMissingSig = await webhookService.verifyAuthentication(
      {
        authType: 'hmac',
        hmacAlgorithm: 'sha256',
        hmacSecret: testSecret,
        hmacHeader: 'x-hub-signature-256',
      },
      { headers: {}, body: {} },
      '{}',
      'wf_test',
      'user_1'
    );
    check('Rejects request with missing signature header', !resMissingSig.valid && resMissingSig.statusCode === 401);
  }

  // ── Group 2: Bearer & API Key Authentication ──────────────────────────────
  console.log('\nGroup 2: Bearer & API Key Authentication');
  {
    // Bearer success
    const resBearerOk = await webhookService.verifyAuthentication(
      { authType: 'bearer', authToken: 'tok_bearer_12345' },
      { headers: { authorization: 'Bearer tok_bearer_12345' } },
      '',
      'wf_test',
      'user_1'
    );
    check('Validates correct Bearer token', resBearerOk.valid === true);

    // Bearer mismatch
    const resBearerFail = await webhookService.verifyAuthentication(
      { authType: 'bearer', authToken: 'tok_bearer_12345' },
      { headers: { authorization: 'Bearer wrong_token' } },
      '',
      'wf_test',
      'user_1'
    );
    check('Rejects invalid Bearer token with 401', !resBearerFail.valid && resBearerFail.statusCode === 401);

    // API Key in header
    const resApiKeyHeader = await webhookService.verifyAuthentication(
      { authType: 'apiKey', apiKeyHeader: 'x-custom-api-key', apiKeyValue: 'ak_test_xyz' },
      { headers: { 'x-custom-api-key': 'ak_test_xyz' }, query: {} },
      '',
      'wf_test',
      'user_1'
    );
    check('Validates API Key in custom header', resApiKeyHeader.valid === true);

    // API Key in query param fallback
    const resApiKeyQuery = await webhookService.verifyAuthentication(
      { authType: 'apiKey', apiKeyHeader: 'x-api-key', apiKeyValue: 'ak_test_xyz' },
      { headers: {}, query: { api_key: 'ak_test_xyz' } },
      '',
      'wf_test',
      'user_1'
    );
    check('Validates API Key from query parameter fallback', resApiKeyQuery.valid === true);

    // Public / none auth
    const resNone = await webhookService.verifyAuthentication(
      { authType: 'none' },
      { headers: {} },
      '',
      'wf_test',
      'user_1'
    );
    check('Allows public access when authType is none', resNone.valid === true);
  }

  // ── Group 3: Replay Protection & Timestamp Verification ───────────────────
  console.log('\nGroup 3: Replay Protection & Timestamp Verification');
  {
    const nowMs = Date.now();

    // Fresh timestamp (30 seconds ago)
    const resFresh = webhookService.verifyTimestamp(
      { checkTimestamp: true, timestampHeader: 'x-timestamp', maxTimestampAge: 300 },
      { headers: { 'x-timestamp': String(Math.floor((nowMs - 30000) / 1000)) } }
    );
    check('Accepts fresh timestamp within 300s window', resFresh.valid === true);

    // Expired timestamp (10 minutes ago)
    const resExpired = webhookService.verifyTimestamp(
      { checkTimestamp: true, timestampHeader: 'x-timestamp', maxTimestampAge: 300 },
      { headers: { 'x-timestamp': String(Math.floor((nowMs - 600000) / 1000)) } }
    );
    check('Rejects expired timestamp (>300s) with 401', !resExpired.valid && resExpired.statusCode === 401);

    // Missing required timestamp
    const resMissingTs = webhookService.verifyTimestamp(
      { checkTimestamp: true, timestampHeader: 'x-timestamp' },
      { headers: {} }
    );
    check('Rejects missing required timestamp header', !resMissingTs.valid && resMissingTs.statusCode === 401);
  }

  // ── Group 4: Payload Size Limits ──────────────────────────────────────────
  console.log('\nGroup 4: Payload Size Limits');
  {
    // Small payload within limit (1000 bytes < 1MB)
    const smallPayload = 'x'.repeat(1000);
    const resSmall = webhookService.verifyPayloadSize(
      { maxPayloadBytes: 1048576 },
      { headers: { 'content-length': '1000' } },
      smallPayload
    );
    check('Allows payload within configured size limit', resSmall.valid === true);

    // Payload exceeding limit (2MB > 1MB)
    const largePayload = 'x'.repeat(2097152);
    const resLarge = webhookService.verifyPayloadSize(
      { maxPayloadBytes: 1048576 },
      { headers: { 'content-length': '2097152' } },
      largePayload
    );
    check('Rejects oversized payload with 413 Payload Too Large', !resLarge.valid && resLarge.statusCode === 413);
  }

  // ── Group 5: Event Type Filtering ─────────────────────────────────────────
  console.log('\nGroup 5: Event Type Filtering');
  {
    const filterConfig = {
      eventTypeFilter: 'payment.succeeded, customer.created',
      eventTypePath: 'event',
      filterAction: 'ignore',
    };

    // Matching event
    const resMatch = webhookService.evaluateEventFilter(
      filterConfig,
      { body: { event: 'payment.succeeded', id: 'pay_1' }, headers: {} }
    );
    check('Matches allowed event type', resMatch.passed === true);

    // Unmatched event
    const resUnmatched = webhookService.evaluateEventFilter(
      filterConfig,
      { body: { event: 'invoice.voided', id: 'inv_1' }, headers: {} }
    );
    check('Filters out un-configured event type', resUnmatched.passed === false);
    check('Action defaults to ignore for filtered event', resUnmatched.action === 'ignore');
  }

  // ── Group 6: Payload Schema & Required Fields ─────────────────────────────
  console.log('\nGroup 6: Payload Schema & Required Fields');
  {
    const schemaConfig = {
      requiredFields: 'id, customer.email, amount',
    };

    // Valid payload
    const resValidPayload = webhookService.validatePayloadSchema(
      schemaConfig,
      { id: 'evt_1', customer: { email: 'alice@example.com' }, amount: 50.0 }
    );
    check('Passes when all required fields are present', resValidPayload.valid === true);

    // Missing nested field
    const resMissingField = webhookService.validatePayloadSchema(
      schemaConfig,
      { id: 'evt_1', customer: {}, amount: 50.0 }
    );
    check('Rejects when required field is missing with 400 Bad Request', !resMissingField.valid && resMissingField.statusCode === 400);
    check('Identifies missing field name in error', resMissingField.error.includes('customer.email'));
  }

  // ── Group 7: Deduplication & Idempotency Key ──────────────────────────────
  console.log('\nGroup 7: Deduplication & Idempotency Key');
  {
    const originalFindOne = WebhookEvent.findOne;
    const originalCreate = WebhookEvent.create;

    // Simulate existing event in DB for this idempotency key
    WebhookEvent.findOne = async function (query) {
      if (query.eventIdentifier === 'idem_key_already_processed') {
        return {
          _id: 'ev_existing_123',
          execution: 'exec_abc',
          status: 'success',
        };
      }
      return null;
    };
    WebhookEvent.create = async function (data) { return { _id: 'ev_new', ...data }; };

    const mockWorkflow = {
      _id: 'wf_dedup_test',
      name: 'Order Webhook Flow',
      owner: 'user_1',
      status: WorkflowStatus.ACTIVE,
      nodes: [
        {
          id: 'n1',
          type: NodeTypes.TRIGGER_WEBHOOK,
          data: {
            authType: 'none',
            idempotencySource: 'header',
            idempotencyField: 'x-idempotency-key',
          },
        },
      ],
    };

    const duplicateReq = {
      method: 'POST',
      url: '/api/workflows/wf_dedup_test/webhook',
      headers: { 'x-idempotency-key': 'idem_key_already_processed' },
      body: { order: '123' },
      query: {},
      params: {},
      ip: '127.0.0.1',
    };

    const result = await webhookService.processWebhook(mockWorkflow, duplicateReq, null);
    check('Detects duplicate event and returns 200 without re-executing', result.status === 200 && result.body.status === 'duplicate');
    check('Preserves original execution ID in duplicate response', result.body.originalExecutionId === 'exec_abc');

    WebhookEvent.findOne = originalFindOne;
    WebhookEvent.create = originalCreate;
  }

  // ── Group 8: Secret Redaction in Webhook Logging ───────────────────────────
  console.log('\nGroup 8: Secret Redaction in Webhook Logging');
  {
    const rawHeaders = {
      'content-type': 'application/json',
      authorization: 'Bearer super_secret_bearer_token_123',
      'x-api-key': 'secret_api_key_456',
      'x-hub-signature-256': 'sha256=1234567890abcdef',
      'user-agent': 'GitHub-Hookshot/1234',
    };

    const redactedHeaders = webhookService.redactWebhookHeaders(rawHeaders);
    check('Masks authorization header', redactedHeaders.authorization === '[REDACTED]');
    check('Masks x-api-key header', redactedHeaders['x-api-key'] === '[REDACTED]');
    check('Masks x-hub-signature-256 header', redactedHeaders['x-hub-signature-256'] === '[REDACTED]');
    check('Preserves non-sensitive headers', redactedHeaders['content-type'] === 'application/json');

    const rawBody = {
      username: 'alice',
      password: 'mypassword123',
      token: 'secret_token_val',
      details: {
        apiKey: 'nested_key_789',
        city: 'New York',
      },
    };

    const redactedBody = webhookService.redactWebhookBody(rawBody);
    check('Masks body password field', redactedBody.password === '[REDACTED]');
    check('Masks body token field', redactedBody.token === '[REDACTED]');
    check('Masks nested apiKey field', redactedBody.details.apiKey === '[REDACTED]');
    check('Preserves non-sensitive body fields', redactedBody.username === 'alice' && redactedBody.details.city === 'New York');
  }

  // ── Group 9: Endpoint Enable/Disable Toggle ───────────────────────────────
  console.log('\nGroup 9: Endpoint Enable/Disable Toggle');
  {
    const originalCreate = WebhookEvent.create;
    WebhookEvent.create = async function (data) { return { _id: 'ev_disabled', ...data }; };

    const disabledWorkflow = {
      _id: 'wf_disabled_test',
      name: 'Disabled Flow',
      owner: 'user_1',
      status: WorkflowStatus.ACTIVE,
      nodes: [
        {
          id: 'n1',
          type: NodeTypes.TRIGGER_WEBHOOK,
          data: { enabled: false }, // Explicitly disabled
        },
      ],
    };

    const req = { method: 'POST', headers: {}, body: {}, query: {}, params: {}, ip: '127.0.0.1' };
    const res = await webhookService.processWebhook(disabledWorkflow, req, null);
    check('Disabled webhook endpoint returns 403 Forbidden', res.status === 403 && res.body.error.includes('disabled'));

    WebhookEvent.create = originalCreate;
  }

  // ── Group 10: Safe Historical Event Replay ────────────────────────────────
  console.log('\nGroup 10: Safe Historical Event Replay');
  {
    const originalEventFindById = WebhookEvent.findById;
    const originalWfFindOne = Workflow.findOne;
    const originalEngineRun = workflowEngine.run;
    const originalEventCreate = WebhookEvent.create;

    WebhookEvent.findById = async function (id) {
      return {
        _id: id,
        workflow: 'wf_replay_123',
        endpointId: 'wh_test',
        body: { customer: 'Bob', action: 'signup' },
        headers: { 'content-type': 'application/json' },
        query: {},
        method: 'POST',
      };
    };

    Workflow.findOne = async function () {
      return { _id: 'wf_replay_123', name: 'Signup Flow', owner: 'owner_user_1', status: WorkflowStatus.ACTIVE };
    };

    let capturedReplayPayload = null;
    workflowEngine.run = async function (wf, owner, trigger, payload) {
      capturedReplayPayload = payload;
      return { _id: 'exec_replayed_456', status: 'success' };
    };

    WebhookEvent.create = async function (data) {
      return { _id: 'ev_replay_rec', ...data };
    };

    const replayRes = await webhookService.replayEvent('ev_original_999', 'owner_user_1');
    check('Safe event replay executes successfully', replayRes.success === true && replayRes.status === 'success');
    check('Replayed payload marks isReplay: true', capturedReplayPayload?.isReplay === true);
    check('Replayed payload preserves original event ID', capturedReplayPayload?.originalEventId === 'ev_original_999');

    // Unauthorized replay attempt
    let replayAuthError = null;
    Workflow.findOne = async function () { return null; }; // Non-owner
    try {
      await webhookService.replayEvent('ev_original_999', 'hacker_user');
    } catch (err) {
      replayAuthError = err;
    }
    check('Blocks unauthorized user from replaying webhook events (403)', replayAuthError?.statusCode === 403);

    // Restore
    WebhookEvent.findById = originalEventFindById;
    Workflow.findOne = originalWfFindOne;
    workflowEngine.run = originalEngineRun;
    WebhookEvent.create = originalEventCreate;
  }

  console.log(`\nAdvanced Webhook Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


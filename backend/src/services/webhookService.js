const crypto = require('crypto');
const Workflow = require('../models/Workflow');
const Execution = require('../models/Execution');
const WebhookEvent = require('../models/WebhookEvent');
const WorkflowSecret = require('../models/WorkflowSecret');
const workflowEngine = require('./workflowEngine');
const CredentialService = require('./CredentialService');
const { WebhookPayload } = require('../utils');
const { NodeTypes, WorkflowStatus } = require('../constants');

/**
 * Constant-time string equality check to prevent timing attacks
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Deep resolution of nested property path (e.g. 'order.id' or 'data.customer.email')
 */
function getNestedValue(obj, pathStr) {
  if (!obj || typeof obj !== 'object' || !pathStr) return undefined;
  const parts = String(pathStr).split('.').map((s) => s.trim()).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Redacts sensitive credentials, tokens, signatures, and headers for safe event logging
 */
function redactWebhookHeaders(headers = {}) {
  const redacted = {};
  const sensitiveHeaderNames = [
    'authorization',
    'x-api-key',
    'api-key',
    'apikey',
    'x-hub-signature',
    'x-hub-signature-256',
    'x-signature',
    'x-webhook-signature',
    'cookie',
    'set-cookie',
  ];

  for (const [k, v] of Object.entries(headers)) {
    if (sensitiveHeaderNames.includes(k.toLowerCase())) {
      redacted[k] = '[REDACTED]';
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

/**
 * Redacts sensitive fields from body payload for safe event logging
 */
function redactWebhookBody(body) {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactWebhookBody);

  const redacted = {};
  const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'private_key', 'authorization'];

  for (const [k, v] of Object.entries(body)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      redacted[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      redacted[k] = redactWebhookBody(v);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

/**
 * Resolves a secret value that may be stored directly, encrypted, or as {{secrets.VAR}}
 */
async function resolveSecret(secretRef, workflowId, ownerId) {
  if (!secretRef || typeof secretRef !== 'string') return '';
  const trimmed = secretRef.trim();

  // Check mustache secret syntax: {{secrets.KEY}}
  const secretMatch = trimmed.match(/^\{\{\s*secrets\.([A-Za-z0-9_-]+)\s*\}\}$/i);
  if (secretMatch) {
    const secretName = secretMatch[1];
    const secretDoc = await WorkflowSecret.findOne({ workflowId, name: secretName });
    if (secretDoc && secretDoc.encryptedValue) {
      try {
        return CredentialService.decrypt(secretDoc.encryptedValue);
      } catch (err) {
        console.warn(`[WebhookService] Failed to decrypt secret "${secretName}":`, err.message);
      }
    }
    return '';
  }

  // Check if encrypted with CredentialService
  if (trimmed.includes(':') && trimmed.length > 32) {
    try {
      return CredentialService.decrypt(trimmed);
    } catch {
      // If decryption fails, fallback to raw value
    }
  }

  return trimmed;
}

/**
 * Finds the trigger-webhook node configuration in a workflow
 * @param {object} workflow
 * @returns {object} Webhook configuration data
 */
function getWebhookNodeConfig(workflow) {
  const node = workflow.nodes?.find((n) => n.type === NodeTypes.TRIGGER_WEBHOOK);
  return node?.data || {};
}

/**
 * Verifies webhook authentication (None, Bearer, API Key, HMAC Signature)
 */
async function verifyAuthentication(config, req, rawBody, workflowId, ownerId) {
  const authType = String(config.authType || 'none').toLowerCase().trim();

  if (authType === 'none') {
    return { valid: true };
  }

  if (authType === 'bearer') {
    const rawExpected = config.authToken || config.token;
    const expectedToken = await resolveSecret(rawExpected, workflowId, ownerId);
    if (!expectedToken) {
      return { valid: false, error: 'Unauthorized: Endpoint misconfigured (missing expected token)', statusCode: 401 };
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const providedToken = match ? match[1].trim() : '';

    if (!providedToken || !timingSafeCompare(providedToken, expectedToken)) {
      return { valid: false, error: 'Unauthorized: Invalid Bearer token', statusCode: 401 };
    }
    return { valid: true };
  }

  if (authType === 'apikey' || authType === 'api_key') {
    const headerName = (config.apiKeyHeader || 'x-api-key').toLowerCase().trim();
    const rawExpected = config.apiKeyValue || config.apiKey;
    const expectedKey = await resolveSecret(rawExpected, workflowId, ownerId);
    if (!expectedKey) {
      return { valid: false, error: 'Unauthorized: Endpoint misconfigured (missing expected API key)', statusCode: 401 };
    }

    const providedKey = req.headers[headerName] || req.query[headerName] || req.query['api_key'] || '';

    if (!providedKey || !timingSafeCompare(String(providedKey), expectedKey)) {
      return { valid: false, error: `Unauthorized: Invalid or missing API key in "${headerName}"`, statusCode: 401 };
    }
    return { valid: true };
  }

  if (authType === 'hmac') {
    const algorithm = (config.hmacAlgorithm || 'sha256').toLowerCase().trim();
    if (!['sha256', 'sha512', 'sha1', 'md5'].includes(algorithm)) {
      return { valid: false, error: `Unsupported HMAC algorithm "${algorithm}"`, statusCode: 400 };
    }

    const rawSecret = config.hmacSecret || config.secret;
    const secret = await resolveSecret(rawSecret, workflowId, ownerId);
    if (!secret) {
      return { valid: false, error: 'Unauthorized: Endpoint misconfigured (missing HMAC secret)', statusCode: 401 };
    }

    const headerName = (config.hmacHeader || 'x-hub-signature-256').toLowerCase().trim();
    const sigHeaderVal = req.headers[headerName];
    if (!sigHeaderVal || typeof sigHeaderVal !== 'string') {
      return { valid: false, error: `Unauthorized: Missing signature in header "${headerName}"`, statusCode: 401 };
    }

    // Strip prefix if configured (e.g. "sha256=" in "sha256=abcdef...")
    let cleanSig = sigHeaderVal.trim();
    const prefix = config.hmacPrefix !== undefined ? config.hmacPrefix : (algorithm === 'sha256' ? 'sha256=' : '');
    if (prefix && cleanSig.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleanSig = cleanSig.substring(prefix.length).trim();
    }

    // Use rawBody buffer or string if available; fallback to JSON stringified body
    let payloadToSign = rawBody;
    if (!payloadToSign) {
      if (typeof req.body === 'string') {
        payloadToSign = req.body;
      } else if (Buffer.isBuffer(req.rawBody)) {
        payloadToSign = req.rawBody;
      } else {
        payloadToSign = JSON.stringify(req.body || {});
      }
    }

    const encoding = (config.hmacEncoding || 'hex').toLowerCase().trim() === 'base64' ? 'base64' : 'hex';
    const computedSignature = crypto.createHmac(algorithm, secret).update(payloadToSign).digest(encoding);

    if (!timingSafeCompare(cleanSig, computedSignature)) {
      return { valid: false, error: 'Unauthorized: HMAC signature mismatch', statusCode: 401 };
    }

    return { valid: true };
  }

  return { valid: false, error: `Unsupported authentication type "${authType}"`, statusCode: 400 };
}

/**
 * Validates request timestamp to prevent replay attacks
 */
function verifyTimestamp(config, req) {
  if (!config.checkTimestamp && !config.timestampHeader) {
    return { valid: true };
  }

  const headerName = (config.timestampHeader || 'x-timestamp').toLowerCase().trim();
  const rawTs = req.headers[headerName] || req.headers['x-request-timestamp'] || req.headers['x-signature-timestamp'];
  if (!rawTs) {
    return { valid: false, error: `Replay Protection: Missing required timestamp header "${headerName}"`, statusCode: 401 };
  }

  let tsMs = NaN;
  if (/^\d+$/.test(String(rawTs).trim())) {
    const num = parseInt(rawTs, 10);
    // If epoch seconds vs milliseconds
    tsMs = num < 10000000000 ? num * 1000 : num;
  } else {
    tsMs = new Date(rawTs).getTime();
  }

  if (isNaN(tsMs)) {
    return { valid: false, error: `Replay Protection: Invalid timestamp value in "${headerName}"`, statusCode: 401 };
  }

  const maxAgeSec = parseInt(config.maxTimestampAge || 300, 10); // Default 300s (5m)
  const diffSec = Math.abs(Date.now() - tsMs) / 1000;

  if (diffSec > maxAgeSec) {
    return {
      valid: false,
      error: `Replay Protection: Request timestamp skewed by ${Math.round(diffSec)}s (max allowed: ${maxAgeSec}s)`,
      statusCode: 401,
    };
  }

  return { valid: true };
}

/**
 * Checks payload size limit
 */
function verifyPayloadSize(config, req, rawBody) {
  const maxBytes = parseInt(config.maxPayloadBytes || 5242880, 10); // Default 5 MB
  let size = 0;

  if (Buffer.isBuffer(rawBody)) {
    size = rawBody.length;
  } else if (typeof rawBody === 'string') {
    size = Buffer.byteLength(rawBody);
  } else if (req.headers['content-length']) {
    size = parseInt(req.headers['content-length'], 10) || 0;
  } else if (req.body) {
    size = Buffer.byteLength(JSON.stringify(req.body));
  }

  if (size > maxBytes) {
    return {
      valid: false,
      error: `Payload size (${size} bytes) exceeds maximum configured limit of ${maxBytes} bytes`,
      statusCode: 413,
    };
  }

  return { valid: true };
}

/**
 * Evaluates event type filter
 */
function evaluateEventFilter(config, req) {
  const filterStr = String(config.eventTypeFilter || '').trim();
  if (!filterStr) return { passed: true };

  const allowedTypes = filterStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowedTypes.length === 0) return { passed: true };

  const eventPath = config.eventTypePath || 'event';
  const extracted =
    getNestedValue(req.body, eventPath) ||
    req.headers[eventPath.toLowerCase()] ||
    req.headers['x-github-event'] ||
    req.headers['x-event-type'] ||
    req.headers['x-event'];

  const eventType = extracted ? String(extracted).trim().toLowerCase() : '';
  const isMatch = allowedTypes.includes(eventType);

  if (!isMatch) {
    const action = String(config.filterAction || 'ignore').toLowerCase();
    return {
      passed: false,
      action,
      eventType: extracted || 'unknown',
      reason: `Event type "${extracted || 'unknown'}" does not match configured filter [${allowedTypes.join(', ')}]`,
    };
  }

  return { passed: true, eventType };
}

/**
 * Validates payload schema or required fields
 */
function validatePayloadSchema(config, body) {
  if (!config.requiredFields && !config.schema) {
    return { valid: true };
  }

  // Required fields list
  let requiredList = [];
  if (Array.isArray(config.requiredFields)) {
    requiredList = config.requiredFields;
  } else if (typeof config.requiredFields === 'string') {
    requiredList = config.requiredFields.split(',').map((s) => s.trim()).filter(Boolean);
  }

  for (const field of requiredList) {
    const val = getNestedValue(body, field);
    if (val === undefined || val === null || val === '') {
      return {
        valid: false,
        error: `Payload Validation: Missing required field "${field}"`,
        statusCode: 400,
      };
    }
  }

  return { valid: true };
}

/**
 * Extracts idempotency key / event identifier from request
 */
function extractEventIdentifier(config, req) {
  const source = config.idempotencySource || 'header';
  const field = config.idempotencyField;

  if (source === 'body' && field) {
    const val = getNestedValue(req.body, field);
    if (val) return String(val).trim();
  }

  // Headers check (explicit or default headers)
  if (field) {
    const val = req.headers[field.toLowerCase()];
    if (val) return String(val).trim();
  }

  const defaultHeaders = [
    'x-idempotency-key',
    'idempotency-key',
    'x-request-id',
    'x-github-delivery',
    'x-webhook-id',
    'x-event-id',
  ];

  for (const h of defaultHeaders) {
    if (req.headers[h]) return String(req.headers[h]).trim();
  }

  // Fallback: body id or eventId if present
  if (req.body && typeof req.body === 'object') {
    if (req.body.id) return String(req.body.id).trim();
    if (req.body.eventId) return String(req.body.eventId).trim();
  }

  return '';
}

/**
 * Main Webhook Processing Pipeline
 * Orchestrates auth, replay check, size, filter, dedup, execution, retries, and recording
 *
 * @param {object} workflow - Mongoose Workflow document
 * @param {object} req - Express request
 * @param {Buffer|string} [rawBody] - Raw unparsed body for HMAC verification
 * @returns {Promise<object>} Outcome response payload & HTTP status
 */
async function processWebhook(workflow, req, rawBody = null) {
  const startTime = Date.now();
  const config = getWebhookNodeConfig(workflow);
  const endpointId = config.endpointId || `wh_${workflow._id}`;
  const correlationId = req.headers['x-correlation-id'] || `corr_${crypto.randomBytes(12).toString('hex')}`;
  const eventIdentifier = extractEventIdentifier(config, req);

  // 1. Check if workflow or endpoint is disabled
  if (config.enabled === false) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: 403,
      failureReason: 'Webhook endpoint is disabled for this workflow',
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: 403,
      body: { error: 'Webhook endpoint is disabled', correlationId },
    };
  }

  if (workflow.status !== WorkflowStatus.ACTIVE) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: 403,
      failureReason: `Workflow "${workflow.name}" is not active (current status: ${workflow.status})`,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: 403,
      body: { error: `Workflow is ${workflow.status}, not active`, correlationId },
    };
  }

  // 2. Check Allowed HTTP Methods
  const allowedMethods = Array.isArray(config.methods) && config.methods.length > 0
    ? config.methods.map((m) => m.toUpperCase())
    : [String(config.method || 'POST').toUpperCase()];

  if (!allowedMethods.includes(req.method.toUpperCase())) {
    return {
      status: 405,
      body: { error: `HTTP method ${req.method} not allowed. Supported: ${allowedMethods.join(', ')}`, correlationId },
    };
  }

  // 3. Payload Size Limit
  const sizeCheck = verifyPayloadSize(config, req, rawBody);
  if (!sizeCheck.valid) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: sizeCheck.statusCode,
      failureReason: sizeCheck.error,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: sizeCheck.statusCode,
      body: { error: sizeCheck.error, correlationId },
    };
  }

  // 4. Verify Authentication (None / Bearer / API Key / HMAC)
  const authResult = await verifyAuthentication(config, req, rawBody, workflow._id, workflow.owner);
  if (!authResult.valid) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: authResult.statusCode,
      failureReason: authResult.error,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: authResult.statusCode,
      body: { error: authResult.error, correlationId },
    };
  }

  // 5. Replay Protection (Timestamp Verification)
  const tsCheck = verifyTimestamp(config, req);
  if (!tsCheck.valid) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: tsCheck.statusCode,
      failureReason: tsCheck.error,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: tsCheck.statusCode,
      body: { error: tsCheck.error, correlationId },
    };
  }

  // 6. Deduplication & Idempotency Check
  if (eventIdentifier) {
    const existing = await WebhookEvent.findOne({
      workflow: workflow._id,
      eventIdentifier,
      status: { $in: ['success', 'duplicate'] },
    });

    if (existing) {
      console.log(`[WebhookService] Duplicate event detected for key "${eventIdentifier}". Execution skipped.`);
      await recordEvent({
        workflow: workflow._id,
        endpointId,
        correlationId,
        eventIdentifier,
        method: req.method,
        url: req.originalUrl || req.url,
        headers: req.headers,
        query: req.query,
        body: req.body,
        status: 'duplicate',
        httpStatus: 200,
        execution: existing.execution,
        failureReason: null,
        ip: req.ip || '127.0.0.1',
        duration: Date.now() - startTime,
      });

      return {
        status: 200,
        body: {
          status: 'duplicate',
          message: 'Duplicate event received and deduplicated',
          eventIdentifier,
          originalExecutionId: existing.execution,
          correlationId,
        },
      };
    }
  }

  // 7. Event Type Filtering
  const filterCheck = evaluateEventFilter(config, req);
  if (!filterCheck.passed) {
    const httpStatus = filterCheck.action === 'reject' ? 400 : 200;
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'ignored',
      httpStatus,
      failureReason: filterCheck.reason,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });

    return {
      status: httpStatus,
      body: {
        status: 'ignored',
        reason: filterCheck.reason,
        correlationId,
      },
    };
  }

  // 8. Payload Schema & Required Fields Validation
  const schemaCheck = validatePayloadSchema(config, req.body || {});
  if (!schemaCheck.valid) {
    await recordEvent({
      workflow: workflow._id,
      endpointId,
      correlationId,
      eventIdentifier,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      status: 'rejected',
      httpStatus: schemaCheck.statusCode,
      failureReason: schemaCheck.error,
      ip: req.ip || '127.0.0.1',
      duration: Date.now() - startTime,
    });
    return {
      status: schemaCheck.statusCode,
      body: { error: schemaCheck.error, correlationId },
    };
  }

  // 9. Execute Workflow with Bounded Retries
  const webhookPayload = WebhookPayload.fromRequest(req);
  webhookPayload.correlationId = correlationId;
  webhookPayload.eventIdentifier = eventIdentifier;

  const retryPolicy = config.retryPolicy || {};
  const maxRetries = Math.min(3, Math.max(0, parseInt(retryPolicy.maxRetries || 0, 10)));
  const baseBackoff = Math.max(100, parseInt(retryPolicy.backoffMs || 300, 10));

  let execution = null;
  let executionError = null;
  let attemptsMade = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptsMade = attempt;
    try {
      execution = await workflowEngine.run(workflow, workflow.owner, 'webhook', webhookPayload);
      if (execution.status === 'success' || execution.status === 'waiting_approval' || execution.status === 'paused') {
        executionError = null;
        break; // Success!
      } else {
        executionError = execution.error || 'Execution failed';
        if (attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 100);
          const delay = baseBackoff * Math.pow(2, attempt) + jitter;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } catch (err) {
      executionError = err.message;
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 100);
        const delay = baseBackoff * Math.pow(2, attempt) + jitter;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const finalStatus = execution && !executionError ? 'success' : 'failed';
  const finalHttpStatus = finalStatus === 'success' ? (parseInt(config.responseStatus || 200, 10)) : 500;

  await recordEvent({
    workflow: workflow._id,
    endpointId,
    correlationId,
    eventIdentifier,
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    status: finalStatus,
    httpStatus: finalHttpStatus,
    execution: execution?._id || null,
    failureReason: executionError,
    retryCount: attemptsMade,
    ip: req.ip || '127.0.0.1',
    duration: Date.now() - startTime,
  });

  if (finalStatus === 'failed') {
    return {
      status: 500,
      body: {
        error: 'Webhook workflow execution failed',
        details: executionError,
        correlationId,
        executionId: execution?._id,
      },
    };
  }

  // Response configuration
  let responseBody = {
    message: 'Webhook received and workflow executed successfully',
    executionId: execution._id,
    status: execution.status,
    correlationId,
    duration: execution.duration,
  };

  if (config.responseBody) {
    if (typeof config.responseBody === 'object') {
      responseBody = { ...config.responseBody, executionId: execution._id, correlationId };
    } else if (typeof config.responseBody === 'string') {
      try {
        responseBody = JSON.parse(config.responseBody);
      } catch {
        responseBody = { message: config.responseBody, executionId: execution._id, correlationId };
      }
    }
  }

  return {
    status: finalHttpStatus,
    headers: config.responseHeaders || {},
    body: responseBody,
  };
}

/**
 * Records an incoming webhook event with sanitized / redacted fields
 */
async function recordEvent(data) {
  try {
    return await WebhookEvent.create({
      ...data,
      headers: redactWebhookHeaders(data.headers),
      body: redactWebhookBody(data.body),
    });
  } catch (err) {
    console.error('[WebhookService] Failed to record webhook event:', err.message);
  }
}

/**
 * Replays a historical webhook event safely
 * @param {string} eventId
 * @param {string} ownerId
 * @returns {Promise<object>}
 */
async function replayEvent(eventId, ownerId) {
  const event = await WebhookEvent.findById(eventId);
  if (!event) {
    const error = new Error('Webhook event not found');
    error.statusCode = 404;
    throw error;
  }

  const workflow = await Workflow.findOne({ _id: event.workflow, owner: ownerId });
  if (!workflow) {
    const error = new Error('Unauthorized or workflow not found');
    error.statusCode = 403;
    throw error;
  }

  const replayedPayload = new WebhookPayload({
    body: event.body || {},
    headers: event.headers || {},
    query: event.query || {},
    params: {},
    method: event.method || 'POST',
    ip: '127.0.0.1 (replay)',
  });
  replayedPayload.isReplay = true;
  replayedPayload.originalEventId = String(event._id);
  replayedPayload.correlationId = `replay_${crypto.randomBytes(8).toString('hex')}`;

  const execution = await workflowEngine.run(workflow, workflow.owner, 'webhook', replayedPayload);

  // Record replay event
  const replayRecord = await WebhookEvent.create({
    workflow: workflow._id,
    endpointId: event.endpointId,
    correlationId: replayedPayload.correlationId,
    eventIdentifier: `replay_${event.eventIdentifier || eventId}_${Date.now()}`,
    method: event.method,
    url: event.url,
    headers: event.headers,
    query: event.query,
    body: event.body,
    status: execution.status === 'success' ? 'success' : 'failed',
    httpStatus: 200,
    execution: execution._id,
    failureReason: execution.error || null,
    ip: '127.0.0.1 (replay)',
    isReplay: true,
  });

  return {
    success: true,
    message: 'Event replayed successfully',
    executionId: execution._id,
    replayEventId: replayRecord._id,
    status: execution.status,
  };
}

/**
 * Lists webhook events for a workflow with pagination and filtering
 */
async function getEventsByWorkflow(workflowId, ownerId, options = {}) {
  const workflow = await Workflow.findOne({ _id: workflowId, owner: ownerId });
  if (!workflow) {
    const error = new Error('Workflow not found');
    error.statusCode = 404;
    throw error;
  }

  const query = { workflow: workflowId };
  if (options.status) query.status = options.status;
  if (options.endpointId) query.endpointId = options.endpointId;

  const limit = Math.min(100, Math.max(1, parseInt(options.limit || 50, 10)));
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    WebhookEvent.find(query)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('execution', 'status startedAt duration'),
    WebhookEvent.countDocuments(query),
  ]);

  return {
    events,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Gets detail for a single webhook event
 */
async function getEventDetail(eventId, ownerId) {
  const event = await WebhookEvent.findById(eventId).populate('execution');
  if (!event) {
    const error = new Error('Webhook event not found');
    error.statusCode = 404;
    throw error;
  }

  const workflow = await Workflow.findOne({ _id: event.workflow, owner: ownerId });
  if (!workflow) {
    const error = new Error('Unauthorized to view this webhook event');
    error.statusCode = 403;
    throw error;
  }

  return event;
}

module.exports = {
  timingSafeCompare,
  redactWebhookHeaders,
  redactWebhookBody,
  resolveSecret,
  getWebhookNodeConfig,
  verifyAuthentication,
  verifyTimestamp,
  verifyPayloadSize,
  evaluateEventFilter,
  validatePayloadSchema,
  extractEventIdentifier,
  processWebhook,
  recordEvent,
  replayEvent,
  getEventsByWorkflow,
  getEventDetail,
};


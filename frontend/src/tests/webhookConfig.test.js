/**
 * webhookConfig.test.js
 *
 * Frontend Unit Tests for Webhook Trigger Configuration & Validation:
 * 1. NodeTypes catalog registration
 * 2. DefaultNodeData configuration for TRIGGER_WEBHOOK
 * 3. NodeValidator rules for webhook authentication, HMAC, and response status
 * 4. NODE_DEFS catalog definition
 */

import { NodeTypes } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { NODE_DEFS } from '../data/templates.js';
import { NodeValidator } from '../validators/NodeValidator.js';

let passed = 0;
let failed = 0;

function check(condition, desc) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Webhook Trigger Frontend Configuration Tests...\n');

  // ── Group 1: NodeTypes & Palette Catalog ─────────────────────────────────
  console.log('Group 1: NodeTypes & Palette Catalog');
  {
    check(NodeTypes.TRIGGER_WEBHOOK === 'trigger-webhook', 'NodeTypes defines TRIGGER_WEBHOOK');

    const def = NODE_DEFS[NodeTypes.TRIGGER_WEBHOOK];
    check(Boolean(def), 'NODE_DEFS contains trigger-webhook definition');
    check(def.category === 'trigger', 'Webhook category is "trigger"');
    check(def.icon === 'Webhook', 'Webhook icon is "Webhook"');
  }

  // ── Group 2: DefaultNodeData Configurations ──────────────────────────────
  console.log('\nGroup 2: DefaultNodeData Configurations');
  {
    const defaults = DefaultNodeData[NodeTypes.TRIGGER_WEBHOOK];
    check(Boolean(defaults), 'DefaultNodeData defines TRIGGER_WEBHOOK');
    check(defaults.authType === 'none', 'Default authType is "none"');
    check(defaults.method === 'POST', 'Default method is "POST"');
    check(defaults.hmacAlgorithm === 'sha256', 'Default HMAC algorithm is "sha256"');
    check(defaults.responseStatus === 200, 'Default response status is 200');
    check(defaults.enabled === true, 'Default enabled is true');
    check(defaults.maxPayloadBytes === 5242880, 'Default maxPayloadBytes is 5MB');
  }

  // ── Group 3: NodeValidator Rules for Webhook ──────────────────────────────
  console.log('\nGroup 3: NodeValidator Rules for Webhook');
  {
    // 1. None auth (valid)
    const validNone = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'none' },
    });
    check(validNone.valid, 'NodeValidator accepts public authType none');

    // 2. Bearer missing token
    const missingBearerToken = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'bearer', authToken: '' },
    });
    check(!missingBearerToken.valid, 'NodeValidator rejects bearer auth with empty token');

    // 3. Bearer valid
    const validBearer = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'bearer', authToken: 'my_token_123' },
    });
    check(validBearer.valid, 'NodeValidator accepts valid bearer auth');

    // 4. API Key missing value
    const missingApiKey = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'apiKey', apiKeyHeader: 'x-api-key', apiKeyValue: '' },
    });
    check(!missingApiKey.valid, 'NodeValidator rejects API Key auth with empty key value');

    // 5. API Key valid
    const validApiKey = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'apiKey', apiKeyHeader: 'x-api-key', apiKeyValue: 'key_xyz' },
    });
    check(validApiKey.valid, 'NodeValidator accepts valid API Key auth');

    // 6. HMAC missing secret
    const missingHmacSecret = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'hmac', hmacSecret: '' },
    });
    check(!missingHmacSecret.valid, 'NodeValidator rejects HMAC auth with empty secret');

    // 7. HMAC invalid algorithm
    const invalidHmacAlgo = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'hmac', hmacSecret: 'secret123', hmacAlgorithm: 'unsupported_algo' },
    });
    check(!invalidHmacAlgo.valid, 'NodeValidator rejects unsupported HMAC algorithm');

    // 8. HMAC valid
    const validHmac = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'hmac', hmacSecret: 'secret123', hmacAlgorithm: 'sha256' },
    });
    check(validHmac.valid, 'NodeValidator accepts valid HMAC auth');

    // 9. Response status invalid
    const invalidStatus = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'none', responseStatus: 9999 },
    });
    check(!invalidStatus.valid, 'NodeValidator rejects out-of-range HTTP status code');

    // 10. Response status valid
    const validStatus = NodeValidator.validateNode({
      type: NodeTypes.TRIGGER_WEBHOOK,
      data: { authType: 'none', responseStatus: 202 },
    });
    check(validStatus.valid, 'NodeValidator accepts valid HTTP status code 202');
  }

  console.log(`\nWebhook Frontend Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

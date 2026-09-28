/**
 * Frontend HTTP Node Configuration & Validation Unit Tests
 */

import NodeValidator from '../validators/NodeValidator.js';
import { NodeTypes } from '../constants/NodeTypes.js';

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
  console.log('\n🧪 Starting Frontend HTTP Node Validation Unit Tests...\n');

  // ── Group 1: Basic Node Validation ─────────────────────────────────────────
  console.log('Group 1: Basic Node Validation');

  const validGetNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com/v1/users', method: 'GET' },
  };
  const getRes = NodeValidator.validateNode(validGetNode);
  assert(getRes.valid === true, 'Validates valid GET node');

  const emptyUrlNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: '   ', method: 'GET' },
  };
  const emptyUrlRes = NodeValidator.validateNode(emptyUrlNode);
  assert(emptyUrlRes.valid === false && emptyUrlRes.error.includes('URL'), 'Rejects empty URL');

  // ── Group 2: HTTP Methods ──────────────────────────────────────────────────
  console.log('\nGroup 2: HTTP Method Validation');

  const patchNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com/item/1', method: 'PATCH' },
  };
  assert(NodeValidator.validateNode(patchNode).valid === true, 'Validates PATCH method');

  const optionsNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com/item/1', method: 'OPTIONS' },
  };
  assert(NodeValidator.validateNode(optionsNode).valid === true, 'Validates OPTIONS method');

  const headNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com/item/1', method: 'HEAD' },
  };
  assert(NodeValidator.validateNode(headNode).valid === true, 'Validates HEAD method');

  const badMethodNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com/item/1', method: 'INVALID' },
  };
  assert(NodeValidator.validateNode(badMethodNode).valid === false, 'Rejects unsupported method "INVALID"');

  // ── Group 3: Authentication Rules ─────────────────────────────────────────
  console.log('\nGroup 3: Authentication Validation');

  const bearerEmptyTokenNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'GET', authType: 'bearer', authToken: '' },
  };
  assert(NodeValidator.validateNode(bearerEmptyTokenNode).valid === false, 'Rejects Bearer Auth without Token');

  const apiKeyMissingValNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'GET', authType: 'api_key', apiKey: 'X-Key', apiValue: '' },
  };
  assert(NodeValidator.validateNode(apiKeyMissingValNode).valid === false, 'Rejects API Key Auth without Key Value');

  const basicAuthMissingPassNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'GET', authType: 'basic', authUsername: 'admin', authPassword: '' },
  };
  assert(NodeValidator.validateNode(basicAuthMissingPassNode).valid === false, 'Rejects Basic Auth without Password');

  const connMissingIdNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'GET', authType: 'connection', connectionId: '' },
  };
  assert(NodeValidator.validateNode(connMissingIdNode).valid === false, 'Rejects Connection Auth without Connection ID');

  // ── Group 4: Body & Advanced Settings ─────────────────────────────────────
  console.log('\nGroup 4: Body & Advanced Options');

  const badJsonBodyNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'POST', contentType: 'json', body: '{ invalid json }' },
  };
  assert(NodeValidator.validateNode(badJsonBodyNode).valid === false, 'Rejects malformed JSON body string');

  const MustacheJsonBodyNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', method: 'POST', contentType: 'json', body: '{"user": "{{steps.n1.name}}"}' },
  };
  assert(NodeValidator.validateNode(MustacheJsonBodyNode).valid === true, 'Allows Mustache variables inside JSON body template');

  const badTimeoutNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', timeout: 50 },
  };
  assert(NodeValidator.validateNode(badTimeoutNode).valid === false, 'Rejects timeout < 100ms');

  const badRetriesNode = {
    type: NodeTypes.ACTION_HTTP,
    data: { url: 'https://api.example.com', retries: 10 },
  };
  assert(NodeValidator.validateNode(badRetriesNode).valid === false, 'Rejects retries > 5');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME FRONTEND HTTP TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL FRONTEND HTTP VALIDATION TESTS PASSED!\n');
  }
}

main();

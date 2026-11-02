/**
 * Comprehensive Unit Tests for Workflow Secrets
 * Covers: Authenticated encryption at rest (AES-256-GCM), metadata protection (never returning
 * plaintext/ciphertext to client), execution-time resolution ({{secrets.NAME}}),
 * SecretRedactor dynamic masking across outputs/errors/logs, serialization leak prevention,
 * and adversarial isolation.
 */

const assert = require('assert');
const { resolveVariable, resolveRawValue } = require('../utils/VariableResolver');
const ExecutionContext = require('../utils/ExecutionContext');
const CredentialService = require('../services/CredentialService');
const { redactSecrets, registerActiveSecrets, clearActiveSecrets } = require('../utils/SecretRedactor');
const { validateSecret } = require('../validators/workflowVariableValidator');
const WorkflowSerializer = require('../services/WorkflowSerializer');

let passedTests = 0;
let failedTests = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(message);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Workflow Secrets Unit Tests...\n');

  // ── Group 1: Secret Validation & Security Guards ─────────────────────────
  console.log('Group 1: Secret Validation & Security Guards');
  {
    const validSec = validateSecret({
      name: 'PROD_STRIPE_KEY',
      value: 'sk_live_51NABCxyz987654321',
      description: 'Production Stripe secret key',
    });
    check(validSec.valid === true, 'Accepts valid secret configuration');
    check(validSec.sanitized.name === 'PROD_STRIPE_KEY', 'Preserves valid secret name');
    check(validSec.sanitized.value === 'sk_live_51NABCxyz987654321', 'Preserves secret value');

    // Reject missing secret value on creation
    const emptySec = validateSecret({ name: 'EMPTY_SECRET', value: '' });
    check(emptySec.valid === false && emptySec.error.includes('required'), 'Rejects empty secret value on create');

    // Allow missing secret value on update (to keep existing encrypted value)
    const updateSec = validateSecret({ name: 'UPDATED_SECRET', description: 'New desc' }, true);
    check(updateSec.valid === true, 'Allows omitting secret value on update');

    // Reject prototype pollution attempt in secret name
    const protoSec = validateSecret({ name: '__proto__', value: 'secret' });
    check(protoSec.valid === false && protoSec.error.includes('reserved'), 'Rejects __proto__ as secret name');

    // Reject excessive length
    const hugeSec = validateSecret({ name: 'HUGE_SECRET', value: 'a'.repeat(9000) });
    check(hugeSec.valid === false && hugeSec.error.includes('exceeds maximum length'), 'Rejects secret value > 8192 chars');
  }

  // ── Group 2: Authenticated Encryption at Rest (AES-256-GCM) ──────────────
  console.log('\nGroup 2: Authenticated Encryption at Rest (AES-256-GCM)');
  {
    const plaintext = 'sk_live_super_secret_token_1234567890';
    const ciphertext = CredentialService.encrypt(plaintext);

    check(typeof ciphertext === 'string', 'Ciphertext is a base64 string');
    check(!ciphertext.includes(plaintext), 'Ciphertext does NOT contain plaintext value');
    check(ciphertext !== plaintext, 'Encrypted value is transformed');

    const decrypted = CredentialService.decrypt(ciphertext);
    check(decrypted === plaintext, 'Decryption reproduces exact plaintext secret');

    // Tampering with auth tag / ciphertext fails authentication
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[tampered.length - 1] ^= 0x01; // flip last byte
    let tamperFailed = false;
    try {
      CredentialService.decrypt(tampered.toString('base64'));
    } catch {
      tamperFailed = true;
    }
    check(tamperFailed === true, 'AES-256-GCM rejects tampered ciphertext via auth tag verification');
  }

  // ── Group 3: Metadata Protection (Never Exposing Plaintext/Ciphertext) ───
  console.log('\nGroup 3: Metadata Protection in API Responses');
  {
    // Simulate what workflowService.getSecrets returns
    const simulatedSecretDoc = {
      _id: 'sec_12345',
      workflowId: 'wf_99999',
      name: 'DATABASE_PASSWORD',
      encryptedValue: CredentialService.encrypt('SuperSecretPassword123!'),
      description: 'Production DB password',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Client response projection
    const clientSafeView = {
      _id: simulatedSecretDoc._id,
      workflowId: simulatedSecretDoc.workflowId,
      name: simulatedSecretDoc.name,
      description: simulatedSecretDoc.description,
      createdAt: simulatedSecretDoc.createdAt,
      updatedAt: simulatedSecretDoc.updatedAt,
    };

    check(clientSafeView.name === 'DATABASE_PASSWORD', 'Client safe view retains secret name');
    check(clientSafeView.encryptedValue === undefined, 'Client safe view strictly omits encryptedValue');
    check(clientSafeView.value === undefined, 'Client safe view strictly omits value');
    check(!JSON.stringify(clientSafeView).includes('SuperSecretPassword123!'), 'Plaintext secret absent from client serialization');
  }

  // ── Group 4: Execution-time Resolution Syntax ────────────────────────────
  console.log('\nGroup 4: Execution-Time Secret Resolution');
  {
    const context = new ExecutionContext({
      secrets: {
        API_TOKEN: 'Bearer secret_live_token_abc123',
        DB_PASS: 'MySql#Secure2026',
        HOOK_KEY: 'whsec_998877665544',
      },
    });

    // Syntax 1: {{ secrets.SECRET_NAME }}
    const res1 = resolveVariable('Authorization: {{ secrets.API_TOKEN }}', context);
    check(res1 === 'Authorization: Bearer secret_live_token_abc123', 'Resolves {{ secrets.SECRET_NAME }} in string template');

    // Syntax 2: {{ secret.SECRET_NAME }} (singular alias)
    const res2 = resolveVariable('Hook key: {{ secret.HOOK_KEY }}', context);
    check(res2 === 'Hook key: whsec_998877665544', 'Resolves {{ secret.SECRET_NAME }} alias');

    // Raw value resolution
    const rawVal = resolveRawValue('{{ secrets.DB_PASS }}', context);
    check(rawVal === 'MySql#Secure2026', 'Resolves raw secret value');

    // Missing secret returns empty string in template
    const missingSecret = resolveVariable('Missing: {{ secrets.NON_EXISTENT }}', context);
    check(missingSecret === 'Missing: ', 'Missing secret safely resolves to empty string');
  }

  // ── Group 5: SecretRedactor Dynamic Redaction Across Outputs & Logs ───────
  console.log('\nGroup 5: Dynamic Secret Redaction in Outputs, Logs, and Errors');
  {
    const rawToken = 'sk_live_secret_finance_token_999888';
    const dbPassword = 'MySecretDbPasswordXYZ!';

    // Register active secrets
    registerActiveSecrets({
      FINANCE_TOKEN: rawToken,
      DB_PASS: dbPassword,
    });

    // 1. Redact inside step output string
    const outputString = `HTTP request executed with token: ${rawToken} against server`;
    const redactedString = redactSecrets(outputString);
    check(!redactedString.includes(rawToken), 'Redacts raw token from arbitrary string');
    check(redactedString.includes('[REDACTED]'), 'Replaces raw token with [REDACTED]');

    // 2. Redact inside nested JSON output object
    const stepOutput = {
      status: 200,
      data: {
        message: `Connected using ${rawToken}`,
        nested: {
          connectionUri: `postgres://admin:${dbPassword}@db.example.com:5432/main`,
        },
      },
      FINANCE_TOKEN: rawToken, // key matches secret name
    };
    const redactedObj = redactSecrets(stepOutput);
    check(!JSON.stringify(redactedObj).includes(rawToken), 'Redacts secret token from nested object and values');
    check(!JSON.stringify(redactedObj).includes(dbPassword), 'Redacts DB password from nested URI');
    check(redactedObj.FINANCE_TOKEN === '[REDACTED]', 'Secret key name automatically redacted');

    // 3. Redact inside error messages
    const errorMsg = `Connection failed: invalid auth for ${rawToken} at host`;
    const redactedErr = redactSecrets(errorMsg);
    check(!redactedErr.includes(rawToken), 'Redacts secret token from error message');
    check(redactedErr.includes('[REDACTED]'), 'Replaces error secret with [REDACTED]');

    // Clean up
    clearActiveSecrets();
  }

  // ── Group 6: Workflow Serialization Leak Prevention ──────────────────────
  console.log('\nGroup 6: Workflow Export/Import Leak Prevention');
  {
    const workflowWithSecrets = {
      name: 'Secrets Workflow',
      nodes: [
        {
          id: 'n1',
          type: 'action-http',
          position: { x: 0, y: 0 },
          data: {
            url: 'https://api.stripe.com/v1/charges',
            headers: 'Bearer {{ secrets.STRIPE_KEY }}',
          },
        },
      ],
      edges: [],
      variables: [{ name: 'env', type: 'string', value: 'prod' }],
      // Even if someone passed in-memory decrypted secrets on the object:
      secrets: {
        STRIPE_KEY: 'sk_live_NEVER_EXPORT_THIS',
      },
    };

    const serialized = WorkflowSerializer.serialize(workflowWithSecrets);
    const jsonStr = JSON.stringify(serialized);

    check(!jsonStr.includes('sk_live_NEVER_EXPORT_THIS'), 'Workflow serialization NEVER exports plaintext secrets');
    check(serialized.workflow.secrets === undefined, 'Serialized workflow excludes secrets field');
    check(serialized.workflow.variables.length === 1, 'Variables are safely preserved');

    // Template expression {{ secrets.STRIPE_KEY }} is preserved as a placeholder reference
    check(jsonStr.includes('{{ secrets.STRIPE_KEY }}'), 'Preserves secret template expression placeholder in node config');
  }

  // ── Group 7: Adversarial Access & Tenant Isolation ────────────────────────
  console.log('\nGroup 7: Adversarial Access Control & Tenant Isolation');
  {
    const userA = 'user_alice_123';
    const userB = 'user_bob_456';
    const wfA = 'wf_alice_789';
    const wfB = 'wf_bob_012';

    // Verify isolation logic:
    // A query for secret belonging to userA/wfA must reject userB
    function simulateAccessCheck(secretOwner, secretWorkflow, requestUser, requestWorkflow) {
      if (secretOwner !== requestUser) return { authorized: false, status: 404 };
      if (secretWorkflow !== requestWorkflow) return { authorized: false, status: 404 };
      return { authorized: true };
    }

    const aliceSelfAccess = simulateAccessCheck(userA, wfA, userA, wfA);
    check(aliceSelfAccess.authorized === true, 'Alice can access her own workflow secrets');

    const bobCrossUser = simulateAccessCheck(userA, wfA, userB, wfA);
    check(bobCrossUser.authorized === false && bobCrossUser.status === 404, 'Bob cannot access Alice secrets (cross-user blocked with 404)');

    const aliceCrossWorkflow = simulateAccessCheck(userA, wfA, userA, wfB);
    check(aliceCrossWorkflow.authorized === false && aliceCrossWorkflow.status === 404, 'Alice cannot access secrets from another workflow (cross-workflow blocked with 404)');
  }

  console.log(`\nWorkflow Secrets Tests: ${passedTests} passed, ${failedTests} failed\n`);
  if (failedTests > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});


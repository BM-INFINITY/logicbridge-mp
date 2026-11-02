/**
 * secretRedactorConcurrency.test.js
 *
 * Verification suite for SecretRedactor concurrency hardening:
 * 1. AsyncLocalStorage execution-scoped isolation
 * 2. Simultaneous parallel workflow executions with independent secret sets
 * 3. Scope cleanup independence (one execution clearing does not clear concurrent runs)
 * 4. Failure-path error handling & cleanup
 * 5. Preservation of standard token/URI redaction
 * 6. Global fallback compatibility for standalone tests
 */

const assert = require('assert');
const {
  redactSecrets,
  redactUriString,
  registerActiveSecrets,
  clearActiveSecrets,
  runWithScope,
  RedactionScope,
  getActiveScope,
} = require('../utils/SecretRedactor');

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n🧪 Starting SecretRedactor Concurrency Hardening Tests...\n');

  // ── Group 1: Execution Scope Isolation ─────────────────────────────────────
  console.log('Group 1: Execution Scope Isolation');
  {
    const scopeA = new RedactionScope('scope-A');
    scopeA.register({ SECRET_A: 'super_secret_alpha_99' });

    const scopeB = new RedactionScope('scope-B');
    scopeB.register({ SECRET_B: 'ultra_secret_bravo_88' });

    check('scopeA holds its secret value', scopeA.secretValues.has('super_secret_alpha_99'));
    check('scopeB holds its secret value', scopeB.secretValues.has('ultra_secret_bravo_88'));
    check('scopeA does not know scopeB secret', !scopeA.secretValues.has('ultra_secret_bravo_88'));
    check('scopeB does not know scopeA secret', !scopeB.secretValues.has('super_secret_alpha_99'));
  }

  // ── Group 2: Concurrent Executions with runWithScope ──────────────────────
  console.log('\nGroup 2: Concurrent Executions with runWithScope');
  {
    const results = await Promise.all([
      // Execution 1
      runWithScope({ API_TOKEN: 'SECRET_EXEC_ONE_TOKEN' }, async () => {
        await delay(30);
        const text = 'Execution 1 output: SECRET_EXEC_ONE_TOKEN and SECRET_EXEC_TWO_TOKEN';
        const redacted = redactSecrets(text);
        return { redacted };
      }),
      // Execution 2
      runWithScope({ API_TOKEN: 'SECRET_EXEC_TWO_TOKEN' }, async () => {
        await delay(15);
        const text = 'Execution 2 output: SECRET_EXEC_ONE_TOKEN and SECRET_EXEC_TWO_TOKEN';
        const redacted = redactSecrets(text);
        return { redacted };
      }),
    ]);

    // Execution 1 should redact SECRET_EXEC_ONE_TOKEN
    check(
      'Execution 1 redacts its own secret',
      results[0].redacted.includes('Execution 1 output: [REDACTED]')
    );
    // Execution 1 should NOT redact SECRET_EXEC_TWO_TOKEN
    check(
      'Execution 1 does not redact Execution 2 secret',
      results[0].redacted.includes('SECRET_EXEC_TWO_TOKEN')
    );

    // Execution 2 should redact SECRET_EXEC_TWO_TOKEN
    check(
      'Execution 2 redacts its own secret',
      results[1].redacted.includes('and [REDACTED]')
    );
    // Execution 2 should NOT redact SECRET_EXEC_ONE_TOKEN
    check(
      'Execution 2 does not redact Execution 1 secret',
      results[1].redacted.includes('SECRET_EXEC_ONE_TOKEN')
    );
  }

  // ── Group 3: Cleanup Independence across Concurrent Workflows ─────────────
  console.log('\nGroup 3: Cleanup Independence Across Concurrent Workflows');
  {
    let exec2FinishedValue = null;

    const [res1, res2] = await Promise.all([
      // Fast workflow: finishes and clears its secrets at 20ms
      runWithScope({ SHORT_LIVED: 'FAST_SECRET_12345' }, async () => {
        await delay(20);
        clearActiveSecrets(); // explicitly clear
        return 'fast done';
      }),
      // Slower workflow: still running at 60ms and tests redaction after fast workflow has cleared!
      runWithScope({ LONG_LIVED: 'SLOW_SECRET_67890' }, async () => {
        await delay(50); // fast workflow has already exited and called clearActiveSecrets()
        const text = 'Slower workflow: SLOW_SECRET_67890';
        exec2FinishedValue = redactSecrets(text);
        return exec2FinishedValue;
      }),
    ]);

    check(
      'Slow workflow still redacts its secrets even after Fast workflow completed & cleared',
      exec2FinishedValue === 'Slower workflow: [REDACTED]'
    );
    check('Fast workflow completed normally', res1 === 'fast done');
  }

  // ── Group 4: Failure-path Error Handling and Resource Cleanup ──────────────
  console.log('\nGroup 4: Failure-Path Error Handling and Resource Cleanup');
  {
    let errorCaught = false;
    let postErrorScope = null;

    try {
      await runWithScope({ FAILING_SECRET: 'DOOMED_VALUE_XYZ' }, async (scope) => {
        check('Scope is active inside failing execution', scope.secretValues.has('DOOMED_VALUE_XYZ'));
        throw new Error('Simulation of catastrophic node failure');
      });
    } catch (err) {
      errorCaught = err.message.includes('Simulation of catastrophic node failure');
      postErrorScope = getActiveScope();
    }

    check('Error properly propagated from runWithScope', errorCaught);
    check(
      'Post-error active scope has no residual DOOMED_VALUE_XYZ',
      !postErrorScope.secretValues.has('DOOMED_VALUE_XYZ')
    );
  }

  // ── Group 5: Fallback to Global Scope for Standalone / Legacy Usage ─────────
  console.log('\nGroup 5: Fallback to Global Scope for Standalone / Legacy Usage');
  {
    clearActiveSecrets();
    registerActiveSecrets({ STANDALONE_SECRET: 'GLOBAL_TEST_VAL_999' });

    const output = redactSecrets('Log message with GLOBAL_TEST_VAL_999');
    check('Standalone registerActiveSecrets redacts globally', output.includes('[REDACTED]'));
    check('Standalone output does not leak raw secret', !output.includes('GLOBAL_TEST_VAL_999'));

    clearActiveSecrets();
    const afterClear = redactSecrets('Log message with GLOBAL_TEST_VAL_999');
    check(
      'After clearActiveSecrets(), global scope is cleared',
      afterClear.includes('GLOBAL_TEST_VAL_999')
    );
  }

  // ── Group 6: Static Credential Masking in Parallel Executions ──────────────
  console.log('\nGroup 6: Static Credential Masking in Parallel Executions');
  {
    await runWithScope({ CUSTOM_TOKEN: 'custom_secret_123' }, async () => {
      const complexData = {
        slackToken: 'xoxb-mock-bot-token-test-fixture',
        discordWebhook: 'https://discord.com/api/webhooks/123456789012345678/secretTokenAlphaNumericXYZ987',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        dbUri: 'postgres://admin:super_secret_pw@db.example.com:5432/mydb',
        authorization: 'Bearer super_secret_bearer_token',
        customField: 'Here is custom_secret_123 in a log',
      };

      const redacted = redactSecrets(complexData);
      check('Slack bot token redacted in parallel scope', redacted.slackToken === '[REDACTED]');
      check(
        'Discord webhook URL redacted in parallel scope',
        redacted.discordWebhook.includes('/[REDACTED]') && !redacted.discordWebhook.includes('secretTokenAlphaNumericXYZ987')
      );
      check('AWS key redacted in parallel scope', redacted.accessKeyId === '[REDACTED]');
      check('DB URI password redacted in parallel scope', redacted.dbUri.includes('admin:[REDACTED]@'));
      check('Authorization header redacted in parallel scope', redacted.authorization === 'Bearer [REDACTED]');
      check('Custom secret redacted in parallel scope', redacted.customField === 'Here is [REDACTED] in a log');
    });
  }

  console.log(`\nSecretRedactor Concurrency Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

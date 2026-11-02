/**
 * waitNode.test.js
 *
 * Tests for Durable Wait Node (`action-wait`):
 * 1. Metadata and registry checks
 * 2. Configuration validation
 * 3. Duration delay calculations and pause signal
 * 4. Timestamp target (date/time) pause signal
 * 5. External event pause signal with secure resumeToken
 * 6. Resumption handling (event payload, timeout)
 */

const assert = require('assert');
const WaitNode = require('../nodes/WaitNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { ExecutionContext } = require('../utils');
const ExecutionPauseSignal = require('../errors/ExecutionPauseSignal');

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
  console.log('\n🧪 Starting Wait Node Unit Tests...\n');

  const node = new WaitNode();

  // ── Group 1: Metadata ─────────────────────────────────────────────────────
  console.log('Group 1: Metadata & Registration');
  check('Correct node type', node.type === NodeTypes.ACTION_WAIT);
  check('Category is action', node.category === 'action');
  check('Node name is Wait / Delay', node.name === 'Wait / Delay');

  // ── Group 2: Configuration Validation ─────────────────────────────────────
  console.log('\nGroup 2: Configuration Validation');
  {
    const invalidType = node.validate({ data: { waitType: 'unknown_type' } });
    check('Rejects invalid wait type', !invalidType.valid);

    const missingDuration = node.validate({ data: { waitType: 'duration' } });
    check('Rejects duration type without durationSeconds', !missingDuration.valid);

    const validDuration = node.validate({ data: { waitType: 'duration', durationSeconds: 30 } });
    check('Accepts valid duration config', validDuration.valid);

    const missingDate = node.validate({ data: { waitType: 'date' } });
    check('Rejects date type without waitUntil', !missingDate.valid);

    const validDate = node.validate({ data: { waitType: 'date', waitUntil: '2026-12-31T23:59:59Z' } });
    check('Accepts valid date config', validDate.valid);

    const missingEvent = node.validate({ data: { waitType: 'event' } });
    check('Rejects event type without eventName', !missingEvent.valid);

    const validEvent = node.validate({ data: { waitType: 'event', eventName: 'payment.received' } });
    check('Accepts valid event config', validEvent.valid);
  }

  // ── Group 3: Duration Delay Pause Signal ───────────────────────────────────
  console.log('\nGroup 3: Duration Delay Pause Signal');
  {
    const context = new ExecutionContext({
      variables: { sleepDuration: 120 },
    });

    let pauseCaught = null;
    const beforeTime = Date.now();
    try {
      await node.execute(
        {
          id: 'wait_node_1',
          data: {
            waitType: 'duration',
            durationSeconds: '{{variables.sleepDuration}}',
          },
        },
        context
      );
    } catch (err) {
      if (err instanceof ExecutionPauseSignal) {
        pauseCaught = err;
      }
    }

    check('Throws ExecutionPauseSignal for duration', pauseCaught !== null);
    check('Signal pauseType is wait', pauseCaught?.pauseType === 'wait');
    check('Details type is duration', pauseCaught?.details?.type === 'duration');
    check('Resolves durationSeconds from variables', pauseCaught?.details?.durationSeconds === 120);
    check(
      'Calculates waitUntil timestamp ~120s in the future',
      pauseCaught?.details?.waitUntil &&
        pauseCaught.details.waitUntil.getTime() >= beforeTime + 119000
    );
  }

  // ── Group 4: Target Timestamp (Date) Pause Signal ──────────────────────────
  console.log('\nGroup 4: Target Timestamp (Date) Pause Signal');
  {
    const context = new ExecutionContext({
      variables: { releaseDate: '2026-12-01T08:00:00.000Z' },
    });

    let pauseCaught = null;
    try {
      await node.execute(
        {
          id: 'wait_node_2',
          data: {
            waitType: 'date',
            waitUntil: '{{variables.releaseDate}}',
          },
        },
        context
      );
    } catch (err) {
      if (err instanceof ExecutionPauseSignal) {
        pauseCaught = err;
      }
    }

    check('Throws ExecutionPauseSignal for date', pauseCaught !== null);
    check('Details type is date', pauseCaught?.details?.type === 'date');
    check(
      'Parses exact ISO timestamp',
      pauseCaught?.details?.waitUntil.toISOString() === '2026-12-01T08:00:00.000Z'
    );
  }

  // ── Group 5: External Event & Resume Token ────────────────────────────────
  console.log('\nGroup 5: External Event & Resume Token');
  {
    const context = new ExecutionContext({
      variables: { webhookEvent: 'stripe.charge.succeeded' },
    });

    let pauseCaught = null;
    try {
      await node.execute(
        {
          id: 'wait_node_3',
          data: {
            waitType: 'event',
            eventName: '{{variables.webhookEvent}}',
            timeoutMinutes: 60,
          },
        },
        context
      );
    } catch (err) {
      if (err instanceof ExecutionPauseSignal) {
        pauseCaught = err;
      }
    }

    check('Throws ExecutionPauseSignal for event', pauseCaught !== null);
    check('Details type is event', pauseCaught?.details?.type === 'event');
    check('Resolves event name', pauseCaught?.details?.eventName === 'stripe.charge.succeeded');
    check(
      'Generates 48-char secure hex resumeToken',
      typeof pauseCaught?.details?.resumeToken === 'string' &&
        pauseCaught.details.resumeToken.length === 48
    );
    check(
      'Calculates timeoutAt timestamp ~60m in the future',
      pauseCaught?.details?.timeoutAt &&
        pauseCaught.details.timeoutAt.getTime() > Date.now() + 59 * 60 * 1000
    );
  }

  // ── Group 6: Resumption Handling ──────────────────────────────────────────
  console.log('\nGroup 6: Resumption Handling');
  {
    // 6.1 Normal event resume with payload
    const eventContext = new ExecutionContext({});
    eventContext.resumingWait = {
      waitId: 'wait_987',
      nodeId: 'wait_node_3',
      status: 'resumed',
      resumedAt: '2026-11-02T13:00:00.000Z',
      resumedBy: 'webhook_token',
      resumePayload: { eventId: 'evt_12345', amount: 99.95, currency: 'usd' },
    };

    const resumedOutput = await node.execute(
      { id: 'wait_node_3', data: { waitType: 'event' } },
      eventContext
    );

    check('Returns resumed status', resumedOutput.status === 'resumed');
    check('Selects resumed branch', resumedOutput.selectedBranch === BranchTypes.RESUMED);
    check('Contains resume payload', resumedOutput.payload.amount === 99.95);
    check('Flags as resumed', resumedOutput.resumed === true);

    // 6.2 Event wait timeout
    const timeoutContext = new ExecutionContext({});
    timeoutContext.resumingWait = {
      waitId: 'wait_987',
      nodeId: 'wait_node_3',
      status: 'timeout',
      resumedAt: '2026-11-02T14:00:00.000Z',
      resumedBy: 'timeout',
      resumePayload: {},
    };

    const timeoutOutput = await node.execute(
      { id: 'wait_node_3', data: { waitType: 'event' } },
      timeoutContext
    );

    check('Returns timeout status on wait expiration', timeoutOutput.status === 'timeout');
    check('Selects timeout branch', timeoutOutput.selectedBranch === BranchTypes.TIMEOUT);
  }

  console.log(`\nWait Node Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

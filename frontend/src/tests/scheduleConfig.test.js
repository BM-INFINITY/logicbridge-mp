/**
 * scheduleConfig.test.js
 *
 * Frontend Unit Tests for Scheduling Improvements & Wait/Delay Palette Deduplication:
 * 1. Palette deduplication: exactly 1 canonical Wait / Delay node in NODE_DEFS
 * 2. Non-enumerable legacy alias resolution for action-delay
 * 3. NODE_TYPE_ALIASES alias mapping
 * 4. WorkflowSerializer legacy normalization
 * 5. NodeValidator support for canonical wait and legacy delay
 * 6. Schedule configuration parameters & timezone support
 */

import { NodeTypes, NODE_TYPE_ALIASES } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { NODE_DEFS } from '../data/templates.js';
import { NodeValidator } from '../validators/NodeValidator.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

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
  console.log('\n🧪 Starting Scheduling Improvements & Wait/Delay Deduplication Frontend Tests...\n');

  // ── Group 1: Palette Deduplication & Canonical Node Definition ───────────
  console.log('Group 1: Palette Deduplication & Canonical Node Definition');
  {
    const keys = Object.keys(NODE_DEFS);
    const actionNodes = Object.entries(NODE_DEFS).filter(([, d]) => d.category === 'action');

    const waitEntries = keys.filter((k) => k === NodeTypes.ACTION_WAIT);
    const delayEntries = keys.filter((k) => k === 'action-delay');

    check(waitEntries.length === 1, 'Exactly one visible palette entry for action-wait');
    check(delayEntries.length === 0, 'action-delay is NOT enumerable in Object.keys(NODE_DEFS)');

    const actionWaitCards = actionNodes.filter(([k]) => k === NodeTypes.ACTION_WAIT);
    const actionDelayCards = actionNodes.filter(([k]) => k === 'action-delay');

    check(actionWaitCards.length === 1, 'Exactly one Wait / Delay action card in action category');
    check(actionDelayCards.length === 0, 'Zero legacy action-delay cards in action category');

    // Canonical def details
    const waitDef = NODE_DEFS[NodeTypes.ACTION_WAIT];
    check(waitDef.label === 'Wait / Delay', 'Canonical node label is "Wait / Delay"');
    check(waitDef.category === 'action', 'Canonical node category is "action"');
    check(waitDef.icon === 'Clock', 'Canonical node icon is "Clock"');

    // Non-enumerable legacy access
    check(Boolean(NODE_DEFS['action-delay']), 'NODE_DEFS["action-delay"] remains accessible for legacy resolution');
    check(NODE_DEFS['action-delay'] === waitDef, 'NODE_DEFS["action-delay"] points to canonical Wait / Delay def');
  }

  // ── Group 2: Alias Mapping & Backward Compatibility ──────────────────────
  console.log('\nGroup 2: Alias Mapping & Backward Compatibility');
  {
    check(NODE_TYPE_ALIASES['action-delay'] === NodeTypes.ACTION_WAIT, 'NODE_TYPE_ALIASES maps "action-delay" to "action-wait"');
    check(NODE_TYPE_ALIASES['action-condition'] === NodeTypes.LOGIC_CONDITION, 'NODE_TYPE_ALIASES maps "action-condition" to "logic-condition"');
    check(NODE_TYPE_ALIASES['logic-switch'] === NodeTypes.ACTION_SWITCH, 'NODE_TYPE_ALIASES maps "logic-switch" to "action-switch"');
  }

  // ── Group 3: NodeValidator for Wait / Delay ──────────────────────────────
  console.log('\nGroup 3: NodeValidator for Wait and Legacy Delay');
  {
    // Canonical Wait validation
    const validCanonicalWait = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'duration', durationSeconds: 30 },
    });
    check(validCanonicalWait.valid, 'NodeValidator accepts valid canonical action-wait duration');

    const validCanonicalDate = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'date', waitUntil: '2026-12-31T00:00:00Z' },
    });
    check(validCanonicalDate.valid, 'NodeValidator accepts valid canonical action-wait date');

    const validCanonicalEvent = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'event', eventName: 'order.placed' },
    });
    check(validCanonicalEvent.valid, 'NodeValidator accepts valid canonical action-wait event');

    // Legacy Delay validation
    const validLegacyDelay = NodeValidator.validateNode({
      type: 'action-delay',
      data: { seconds: 15 },
    });
    check(validLegacyDelay.valid, 'NodeValidator accepts legacy action-delay with seconds data');
  }

  // ── Group 4: WorkflowSerializer Normalization ────────────────────────────
  console.log('\nGroup 4: WorkflowSerializer Normalization');
  {
    const legacyWorkflowPkg = {
      schemaVersion: '1.0.0',
      workflow: {
        name: 'Legacy Delay Flow',
        nodes: [
          { id: 't1', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 0 }, data: { label: 'Start' } },
          { id: 'd1', type: 'action-delay', position: { x: 200, y: 0 }, data: { label: 'Delay 10s', seconds: 10 } },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'd1' },
        ],
      },
    };

    const deserialized = WorkflowSerializer.deserialize(legacyWorkflowPkg);
    check(deserialized.nodes.length === 2, 'Deserializes all nodes from legacy package');
    check(deserialized.nodes[1].type === NodeTypes.ACTION_WAIT, 'Normalizes legacy "action-delay" to "action-wait"');
    check(deserialized.nodes[1].data.seconds === 10, 'Preserves legacy delay configuration data');
  }

  // ── Group 5: Schedule Configuration Data Integrity ───────────────────────
  console.log('\nGroup 5: Schedule Configuration Data Integrity');
  {
    // Default data includes trigger-schedule
    const schedDefaults = DefaultNodeData[NodeTypes.TRIGGER_SCHEDULE];
    check(Boolean(schedDefaults), 'DefaultNodeData defines TRIGGER_SCHEDULE');
    check(Boolean(schedDefaults.cron), 'TRIGGER_SCHEDULE default provides cron template');

    // Common timezones verification
    const supportedTimezones = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Asia/Dubai',
      'Australia/Sydney',
    ];

    const allValid = supportedTimezones.every((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    });
    check(allValid, 'All common schedule timezones are supported by the Intl runtime');
  }

  console.log(`\nScheduling Improvements Frontend Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


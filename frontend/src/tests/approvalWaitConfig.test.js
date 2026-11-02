/**
 * approvalWaitConfig.test.js
 *
 * Frontend Unit Tests for Human Approval & Wait Nodes:
 * 1. NodeTypes catalog registration
 * 2. NODE_DEFS palette definitions (exact canonical entries, no duplicates)
 * 3. DefaultNodeData configurations
 * 4. NodeValidator rules for approval and wait nodes
 * 5. Icon mappings
 * 6. Serialization round-trip preservation
 */

import { NodeTypes } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { NODE_DEFS } from '../data/templates.js';
import { getNodeIcon } from '../constants/Icons.js';
import { NodeValidator } from '../validators/NodeValidator.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Approval & Wait Frontend Configuration Tests...\n');

  // ── Group 1: NodeTypes Catalog ────────────────────────────────────────────
  console.log('Group 1: NodeTypes Catalog');
  check(NodeTypes.ACTION_APPROVAL === 'action-approval', 'NodeTypes defines ACTION_APPROVAL');
  check(NodeTypes.ACTION_WAIT === 'action-wait', 'NodeTypes defines ACTION_WAIT');

  // ── Group 2: Palette NODE_DEFS Registration ───────────────────────────────
  console.log('\nGroup 2: Palette NODE_DEFS Registration');
  const approvalDef = NODE_DEFS[NodeTypes.ACTION_APPROVAL];
  const waitDef = NODE_DEFS[NodeTypes.ACTION_WAIT];

  check(Boolean(approvalDef), 'NODE_DEFS contains action-approval');
  check(approvalDef?.label === 'Human Approval', 'Approval node label is Human Approval');
  check(approvalDef?.category === 'action', 'Approval node is in action category');
  check(Array.isArray(approvalDef?.configSchema), 'Approval node provides configSchema');

  check(Boolean(waitDef), 'NODE_DEFS contains action-wait');
  check(waitDef?.label === 'Wait / Delay', 'Wait node label is Wait / Delay');
  check(waitDef?.category === 'action', 'Wait node is in action category');
  check(Array.isArray(waitDef?.configSchema), 'Wait node provides configSchema');

  // Verify no duplicate palette entries in Object.entries(NODE_DEFS)
  const paletteKeys = Object.keys(NODE_DEFS);
  const approvalEntries = paletteKeys.filter((k) => k === NodeTypes.ACTION_APPROVAL);
  const waitEntries = paletteKeys.filter((k) => k === NodeTypes.ACTION_WAIT);
  check(approvalEntries.length === 1, 'Exactly one visible palette entry for action-approval');
  check(waitEntries.length === 1, 'Exactly one visible palette entry for action-wait');

  // ── Group 3: DefaultNodeData Configurations ───────────────────────────────
  console.log('\nGroup 3: DefaultNodeData Configurations');
  const approvalDefaults = DefaultNodeData[NodeTypes.ACTION_APPROVAL];
  const waitDefaults = DefaultNodeData[NodeTypes.ACTION_WAIT];

  check(Boolean(approvalDefaults), 'DefaultNodeData defines ACTION_APPROVAL');
  check(approvalDefaults?.title === 'Approval Required', 'Approval default title is set');
  check(approvalDefaults?.timeoutAction === 'reject', 'Approval default timeout action is reject');

  check(Boolean(waitDefaults), 'DefaultNodeData defines ACTION_WAIT');
  check(waitDefaults?.waitType === 'duration', 'Wait default type is duration');
  check(waitDefaults?.durationSeconds === 60, 'Wait default duration is 60 seconds');

  // ── Group 4: NodeValidator for Approval and Wait ──────────────────────────
  console.log('\nGroup 4: NodeValidator for Approval and Wait');
  {
    // Approval validation
    const missingTitle = NodeValidator.validateNode({
      type: NodeTypes.ACTION_APPROVAL,
      data: { title: '' },
    });
    check(!missingTitle.valid, 'NodeValidator rejects empty approval title');

    const invalidTimeout = NodeValidator.validateNode({
      type: NodeTypes.ACTION_APPROVAL,
      data: { title: 'Approve Budget', timeoutMinutes: -10 },
    });
    check(!invalidTimeout.valid, 'NodeValidator rejects negative timeout minutes');

    const validApproval = NodeValidator.validateNode({
      type: NodeTypes.ACTION_APPROVAL,
      data: { title: 'Approve Budget', timeoutMinutes: 60, timeoutAction: 'reject' },
    });
    check(validApproval.valid, 'NodeValidator accepts valid approval node data');

    // Wait validation
    const invalidWaitType = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'invalid_mode' },
    });
    check(!invalidWaitType.valid, 'NodeValidator rejects invalid waitType');

    const missingDuration = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'duration', durationSeconds: '' },
    });
    check(!missingDuration.valid, 'NodeValidator rejects duration mode without durationSeconds');

    const validWaitDuration = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'duration', durationSeconds: 120 },
    });
    check(validWaitDuration.valid, 'NodeValidator accepts valid duration wait data');

    const missingDate = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'date', waitUntil: '' },
    });
    check(!missingDate.valid, 'NodeValidator rejects date mode without waitUntil');

    const validWaitDate = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'date', waitUntil: '2026-12-31T23:59:59Z' },
    });
    check(validWaitDate.valid, 'NodeValidator accepts valid date wait data');

    const missingEvent = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'event', eventName: '' },
    });
    check(!missingEvent.valid, 'NodeValidator rejects event mode without eventName');

    const validWaitEvent = NodeValidator.validateNode({
      type: NodeTypes.ACTION_WAIT,
      data: { waitType: 'event', eventName: 'order.shipped', timeoutMinutes: 120 },
    });
    check(validWaitEvent.valid, 'NodeValidator accepts valid event wait data');
  }

  // ── Group 5: Icons Registry ───────────────────────────────────────────────
  console.log('\nGroup 5: Icons Registry');
  const approvalIcon = getNodeIcon(NodeTypes.ACTION_APPROVAL);
  const waitIcon = getNodeIcon(NodeTypes.ACTION_WAIT);
  check(typeof approvalIcon === 'function' || typeof approvalIcon === 'object', 'Approval icon mapped in getNodeIcon');
  check(typeof waitIcon === 'function' || typeof waitIcon === 'object', 'Wait icon mapped in getNodeIcon');

  // ── Group 6: Serialization Round-Trip ─────────────────────────────────────
  console.log('\nGroup 6: Serialization Round-Trip');
  {
    const workflow = {
      name: 'Approval & Wait Flow',
      nodes: [
        { id: 'n1', type: NodeTypes.TRIGGER_MANUAL, position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'n2',
          type: NodeTypes.ACTION_APPROVAL,
          position: { x: 200, y: 0 },
          data: {
            label: 'Manager Approval',
            title: 'Expense Approval',
            allowedApprovers: 'mgr@example.com',
            timeoutMinutes: 60,
          },
        },
        {
          id: 'n3',
          type: NodeTypes.ACTION_WAIT,
          position: { x: 400, y: 0 },
          data: {
            label: 'Delay 10m',
            waitType: 'duration',
            durationSeconds: 600,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'approved' },
      ],
    };

    const pkg = WorkflowSerializer.serialize(workflow);
    check(pkg.workflow.nodes.length === 3, 'Serialized all 3 nodes');
    check(pkg.workflow.nodes.some((n) => n.type === NodeTypes.ACTION_APPROVAL), 'Serialized approval node');
    check(pkg.workflow.nodes.some((n) => n.type === NodeTypes.ACTION_WAIT), 'Serialized wait node');

    const deserialized = WorkflowSerializer.deserialize(pkg);
    check(deserialized.nodes.length === 3, 'Deserialized all 3 nodes');
    const deserializedApproval = deserialized.nodes.find((n) => n.type === NodeTypes.ACTION_APPROVAL);
    check(deserializedApproval.data.title === 'Expense Approval', 'Preserved approval configuration across round-trip');
  }

  console.log(`\nApproval & Wait Frontend Tests: ${passed} passed, ${failed} failed\n`);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

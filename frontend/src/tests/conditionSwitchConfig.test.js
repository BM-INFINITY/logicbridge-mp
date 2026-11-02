/**
 * Frontend Advanced Condition & Switch Configuration & Validation Tests
 */

import { NodeValidator } from '../validators/NodeValidator.js';
import { NodeTypes, normalizeNodeType } from '../constants/NodeTypes.js';
import { DefaultNodeData } from '../constants/DefaultNodeData.js';
import { getNodeIcon } from '../constants/Icons.js';
import { NODE_DEFS } from '../data/templates.js';
import { ReactFlowAdapter } from '../adapters/ReactFlowAdapter.js';
import { ReplayService } from '../services/ReplayService.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('\n🧪 Starting Frontend Advanced Condition & Switch Unit Tests...\n');

// ── Group 1: Condition Node Validation ──────────────────────────────────────
console.log('Group 1: Condition Node Validation');
try {
  const validFlat = NodeValidator.validateNode({
    type: NodeTypes.LOGIC_CONDITION,
    data: { leftValue: '{{prev.status}}', operator: 'equals', rightValue: 'active' },
  });
  check(validFlat.valid === true, 'Condition: validates valid flat condition');

  const validAdvanced = NodeValidator.validateNode({
    type: NodeTypes.LOGIC_CONDITION,
    data: {
      combinator: 'and',
      conditions: [
        { leftValue: '{{prev.count}}', operator: 'greater_than', rightValue: 10 },
        { leftValue: '{{prev.verified}}', operator: 'is_true' },
      ],
    },
  });
  check(validAdvanced.valid === true, 'Condition: validates valid AND condition group');

  const invalidCombinator = NodeValidator.validateNode({
    type: NodeTypes.LOGIC_CONDITION,
    data: {
      combinator: 'invalid_comb',
      conditions: [{ leftValue: 'a', operator: 'equals', rightValue: 'b' }],
    },
  });
  check(invalidCombinator.valid === false, 'Condition: rejects invalid combinator');

  const invalidOperator = NodeValidator.validateNode({
    type: NodeTypes.LOGIC_CONDITION,
    data: { leftValue: 'a', operator: 'UNKNOWN_OPERATOR', rightValue: 'b' },
  });
  check(invalidOperator.valid === false, 'Condition: rejects unsupported comparison operator');

  const actionConditionValid = NodeValidator.validateNode({
    type: NodeTypes.ACTION_CONDITION,
    data: { leftValue: 'a', operator: 'starts_with', rightValue: 'pre_' },
  });
  check(actionConditionValid.valid === true, 'Condition: validates action-condition alias');
} catch (err) {
  console.error('Error in Group 1:', err);
  failed++;
}

// ── Group 2: Switch / Router Node Validation ────────────────────────────────
console.log('\nGroup 2: Switch / Router Node Validation');
try {
  const validSwitch = NodeValidator.validateNode({
    type: NodeTypes.ACTION_SWITCH,
    data: {
      input: '{{steps.api.role}}',
      cases: [
        { id: 'case_1', label: 'Admin', value: 'admin' },
        { id: 'case_2', label: 'Editor', value: 'editor' },
      ],
      defaultHandle: 'default',
    },
  });
  check(validSwitch.valid === true, 'Switch: validates valid switch node');

  const invalidCasesType = NodeValidator.validateNode({
    type: NodeTypes.ACTION_SWITCH,
    data: { cases: 'not-an-array' },
  });
  check(invalidCasesType.valid === false, 'Switch: rejects non-array cases');

  const dupCaseId = NodeValidator.validateNode({
    type: NodeTypes.ACTION_SWITCH,
    data: {
      cases: [
        { id: 'case_dup', label: 'A', value: '1' },
        { id: 'case_dup', label: 'B', value: '2' },
      ],
    },
  });
  check(dupCaseId.valid === false, 'Switch: rejects duplicate case IDs');

  const reservedDefault = NodeValidator.validateNode({
    type: NodeTypes.ACTION_SWITCH,
    data: {
      cases: [{ id: 'default', label: 'Default', value: 'test' }],
    },
  });
  check(reservedDefault.valid === false, 'Switch: rejects case ID named "default"');
} catch (err) {
  console.error('Error in Group 2:', err);
  failed++;
}

// ── Group 3: DefaultNodeData Defaults ───────────────────────────────────────
console.log('\nGroup 3: DefaultNodeData Defaults');
try {
  check(DefaultNodeData[NodeTypes.ACTION_SWITCH] !== undefined, 'DefaultNodeData defines ACTION_SWITCH');
  check(DefaultNodeData[NodeTypes.LOGIC_SWITCH] !== undefined, 'DefaultNodeData defines LOGIC_SWITCH');
  check(DefaultNodeData[NodeTypes.ACTION_SWITCH].label === 'Switch / Router', 'Switch default label matches');
  check(Array.isArray(DefaultNodeData[NodeTypes.ACTION_SWITCH].cases), 'Switch default cases is an array');
  check(DefaultNodeData[NodeTypes.ACTION_SWITCH].defaultHandle === 'default', 'Switch default fallback handle is default');

  check(DefaultNodeData[NodeTypes.LOGIC_CONDITION] !== undefined, 'DefaultNodeData defines LOGIC_CONDITION');
  check(DefaultNodeData[NodeTypes.LOGIC_CONDITION].combinator === 'and', 'Condition default combinator is and');
} catch (err) {
  console.error('Error in Group 3:', err);
  failed++;
}

// ── Group 4: Icon Mapping & Palette Definitions ─────────────────────────────
console.log('\nGroup 4: Icon Mapping & Palette Definitions');
try {
  const switchIcon = getNodeIcon('action-switch');
  check(typeof switchIcon === 'function' || typeof switchIcon === 'object', 'getNodeIcon returns icon for action-switch');

  const logicSwitchIcon = getNodeIcon('logic-switch');
  check(typeof logicSwitchIcon === 'function' || typeof logicSwitchIcon === 'object', 'getNodeIcon returns icon for logic-switch');

  const condIcon = getNodeIcon('action-condition');
  check(typeof condIcon === 'function' || typeof condIcon === 'object', 'getNodeIcon returns icon for action-condition');

  check(NODE_DEFS['action-switch'] !== undefined, 'NODE_DEFS contains action-switch');
  check(NODE_DEFS['action-switch'].category === 'logic', 'action-switch category is logic');
  check(NODE_DEFS['action-switch'].color === '#8b5cf6', 'action-switch color is purple (#8b5cf6)');

  // Verify Palette Deduplication in Logic Category
  const logicEntries = Object.entries(NODE_DEFS).filter(([, d]) => d.category === 'logic');
  check(logicEntries.length === 3, `Logic category has exactly 3 entries in palette (found ${logicEntries.length})`);

  const logicKeys = logicEntries.map(([k]) => k);
  check(logicKeys.includes('logic-condition'), 'Logic palette contains canonical logic-condition');
  check(logicKeys.includes('action-switch'), 'Logic palette contains canonical action-switch');
  check(logicKeys.includes('action-loop'), 'Logic palette contains canonical action-loop');
  check(!logicKeys.includes('action-condition'), 'Logic palette does NOT duplicate action-condition alias');
  check(!logicKeys.includes('logic-switch'), 'Logic palette does NOT duplicate logic-switch alias');

  // Verify non-enumerable backward-compatibility resolution
  check(NODE_DEFS['action-condition'] !== undefined, 'Legacy alias action-condition resolves definition');
  check(NODE_DEFS['logic-switch'] !== undefined, 'Legacy alias logic-switch resolves definition');
} catch (err) {
  console.error('Error in Group 4:', err);
  failed++;
}

// ── Group 5: Edge Connection & Duplicate Branch Rules ───────────────────────
console.log('\nGroup 5: Edge Connection & Duplicate Branch Rules');
try {
  const existingEdges = [
    { id: 'e1', source: 'sw_1', target: 'log_1', sourceHandle: 'case_1' },
    { id: 'e2', source: 'sw_1', target: 'log_def', sourceHandle: 'default' },
  ];

  // Try connecting another target from case_1 (duplicate handle)
  const dupCheck = NodeValidator.validateConditionConnection(
    { source: 'sw_1', target: 'log_another', sourceHandle: 'case_1' },
    existingEdges
  );
  check(dupCheck.valid === false, 'Rejects duplicate connection from switch case handle');

  // Try connecting from an unassigned case_2 (allowed)
  const allowedCheck = NodeValidator.validateConditionConnection(
    { source: 'sw_1', target: 'log_new', sourceHandle: 'case_2' },
    existingEdges
  );
  check(allowedCheck.valid === true, 'Allows connection from unused case_2 handle');
} catch (err) {
  console.error('Error in Group 5:', err);
  failed++;
}

// ── Group 6: ReplayService Switch Tracking ──────────────────────────────────
console.log('\nGroup 6: ReplayService Switch Tracking');
try {
  const mockExecution = {
    startedAt: '2026-11-02T10:00:00.000Z',
    steps: [
      {
        nodeId: 'sw_node',
        nodeName: 'Router',
        nodeType: 'action-switch',
        status: 'success',
        startedAt: '2026-11-02T10:00:00.000Z',
        finishedAt: '2026-11-02T10:00:00.050Z',
        output: {
          matched: true,
          selectedBranch: 'case_vip',
          matchedCaseLabel: 'VIP Customers',
        },
      },
    ],
  };

  const snapshots = ReplayService.buildSnapshots(mockExecution, [{ id: 'sw_node', type: 'action-switch' }]);
  check(snapshots.length >= 2, 'Generated snapshots for switch execution');

  const finalSnapshot = snapshots[snapshots.length - 1];
  check(finalSnapshot.selectedBranches['sw_node'] === 'case_vip', 'Replay tracks selectedBranch case_vip');

  const switchEvents = finalSnapshot.events.filter((e) => e.type === 'SWITCH_EVALUATED');
  check(switchEvents.length === 1, 'ReplayService emitted SWITCH_EVALUATED event');
  check(switchEvents[0].details.includes('case_vip'), 'Event details describe routed branch');
} catch (err) {
  console.error('Error in Group 6:', err);
  failed++;
}

// ── Group 7: Alias Normalization & Workflow Deserialization ──────────────────
console.log('\nGroup 7: Alias Normalization & Workflow Deserialization');
try {
  check(normalizeNodeType('action-condition') === 'logic-condition', 'normalizeNodeType maps action-condition to logic-condition');
  check(normalizeNodeType('logic-switch') === 'action-switch', 'normalizeNodeType maps logic-switch to action-switch');
  check(normalizeNodeType('action-loop') === 'action-loop', 'normalizeNodeType preserves canonical action-loop');

  // Test loading workflow with legacy aliases
  const legacyWorkflow = {
    manifest: { schemaVersion: '1.0.0' },
    workflow: {
      name: 'Legacy Alias Workflow',
      nodes: [
        { id: 'n1', type: 'action-condition', position: { x: 0, y: 0 }, data: { leftValue: 'a' } },
        { id: 'n2', type: 'logic-switch', position: { x: 100, y: 100 }, data: { input: 'b' } },
        { id: 'n3', type: 'action-loop', position: { x: 200, y: 200 }, data: { items: [1] } },
      ],
      edges: [],
    },
  };

  const deserialized = WorkflowSerializer.deserialize(legacyWorkflow);
  check(deserialized.nodes.length === 3, 'Deserialized all 3 nodes');
  check(deserialized.nodes[0].type === 'logic-condition', 'action-condition normalized to logic-condition');
  check(deserialized.nodes[1].type === 'action-switch', 'logic-switch normalized to action-switch');
  check(deserialized.nodes[2].type === 'action-loop', 'action-loop preserved as canonical');
} catch (err) {
  console.error('Error in Group 7:', err);
  failed++;
}

console.log(`\nFrontend Condition & Switch Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}


import { describe, it } from 'node:test';
import assert from 'node:assert';
import useCanvasStore from '../store/canvasStore.js';
import NodeValidator from '../validators/NodeValidator.js';
import { NODE_DEFS } from '../data/templates.js';
import { NodeTypes } from '../constants/NodeTypes.js';

describe('Workflow Builder UX & Canvas Interactions', () => {
  it('History Stack: records snapshots and performs undo/redo correctly', () => {
    const store = useCanvasStore.getState();
    store.resetCanvas();

    assert.strictEqual(store.canUndo(), false);
    assert.strictEqual(store.canRedo(), false);

    // Initial state
    const nodeA = { id: 'node_1', type: 'trigger-manual', position: { x: 100, y: 100 }, data: { label: 'Start' } };
    store.setNodes([nodeA]);

    // Snapshot 1
    store.takeSnapshot();

    // Add Node B
    const nodeB = { id: 'node_2', type: 'action-http', position: { x: 340, y: 100 }, data: { label: 'Fetch' } };
    store.setNodes([nodeA, nodeB]);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 2);
    assert.strictEqual(useCanvasStore.getState().canUndo(), true);

    // Snapshot 2
    store.takeSnapshot();

    // Add Edge
    const edge = { id: 'e1-2', source: 'node_1', target: 'node_2' };
    store.setEdges([edge]);
    assert.strictEqual(useCanvasStore.getState().edges.length, 1);

    // Perform Undo (reverts edge addition)
    const undoSuccess1 = store.undo();
    assert.strictEqual(undoSuccess1, true);
    assert.strictEqual(useCanvasStore.getState().edges.length, 0);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 2);
    assert.strictEqual(useCanvasStore.getState().canRedo(), true);

    // Perform Undo (reverts nodeB addition)
    const undoSuccess2 = store.undo();
    assert.strictEqual(undoSuccess2, true);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 1);
    assert.strictEqual(useCanvasStore.getState().nodes[0].id, 'node_1');

    // Perform Redo (restores nodeB)
    const redoSuccess1 = store.redo();
    assert.strictEqual(redoSuccess1, true);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 2);

    // Perform Redo (restores edge)
    const redoSuccess2 = store.redo();
    assert.strictEqual(redoSuccess2, true);
    assert.strictEqual(useCanvasStore.getState().edges.length, 1);
    assert.strictEqual(useCanvasStore.getState().canRedo(), false);
  });

  it('Clipboard & Duplication: copies, pastes with offset, duplicates, and deletes', () => {
    const store = useCanvasStore.getState();
    store.resetCanvas();

    const node1 = { id: 'node_orig', type: 'action-transform', position: { x: 200, y: 150 }, data: { label: 'Transform Order' }, selected: true };
    store.setNodes([node1]);

    // Copy selected node
    const copiedCount = store.copySelected();
    assert.strictEqual(copiedCount, 1);
    assert.strictEqual(useCanvasStore.getState().clipboard.length, 1);
    assert.strictEqual(useCanvasStore.getState().clipboard[0].id, 'node_orig');

    // Paste node with offset (+40, +40)
    const pasted = store.pasteNodes({ x: 40, y: 40 });
    assert.strictEqual(pasted.length, 1);
    assert.notStrictEqual(pasted[0].id, 'node_orig');
    assert.strictEqual(pasted[0].position.x, 240);
    assert.strictEqual(pasted[0].position.y, 190);
    assert.strictEqual(pasted[0].data.label, 'Transform Order (Copy)');
    assert.strictEqual(useCanvasStore.getState().nodes.length, 2);

    // Duplicate single node
    const duplicated = store.duplicateNode('node_orig', { x: 50, y: 50 });
    assert.ok(duplicated);
    assert.strictEqual(duplicated.position.x, 250);
    assert.strictEqual(duplicated.position.y, 200);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 3);

    // Select all nodes
    store.selectAllNodes();
    assert.ok(useCanvasStore.getState().nodes.every((n) => n.selected));

    // Delete selected nodes (bulk delete)
    const deletedCount = store.deleteSelectedNodes();
    assert.strictEqual(deletedCount, 3);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 0);
  });

  it('Connection Validation: enforces branch uniqueness and disallows self-connections', () => {
    const existingEdges = [
      { id: 'e1', source: 'cond_1', sourceHandle: 'true', target: 'http_1' },
      { id: 'e2', source: 'loop_1', sourceHandle: 'loop', target: 'log_1' },
      { id: 'e3', source: 'approval_1', sourceHandle: 'approved', target: 'notify_1' },
    ];

    // Disallow duplicate 'true' branch
    const duplicateTrue = NodeValidator.validateConditionConnection(
      { source: 'cond_1', sourceHandle: 'true', target: 'http_2' },
      existingEdges
    );
    assert.strictEqual(duplicateTrue.valid, false);
    assert.ok(duplicateTrue.error.includes('TRUE'));

    // Allow unused 'false' branch on the same condition node
    const validFalse = NodeValidator.validateConditionConnection(
      { source: 'cond_1', sourceHandle: 'false', target: 'http_2' },
      existingEdges
    );
    assert.strictEqual(validFalse.valid, true);

    // Disallow duplicate 'loop' branch
    const duplicateLoop = NodeValidator.validateConditionConnection(
      { source: 'loop_1', sourceHandle: 'loop', target: 'log_2' },
      existingEdges
    );
    assert.strictEqual(duplicateLoop.valid, false);

    // Disallow duplicate 'approved' branch
    const duplicateApproval = NodeValidator.validateConditionConnection(
      { source: 'approval_1', sourceHandle: 'approved', target: 'notify_2' },
      existingEdges
    );
    assert.strictEqual(duplicateApproval.valid, false);
  });

  it('Workflow-wide Validation: aggregates errors across invalid steps', () => {
    const invalidNodes = [
      { id: 'n1', type: NodeTypes.ACTION_HTTP, data: { label: 'Empty HTTP', url: '' } },
      { id: 'n2', type: NodeTypes.ACTION_CSV, data: { label: 'Empty CSV', columns: [] } },
      { id: 'n3', type: NodeTypes.ACTION_AI_AGENT, data: { label: 'Agent', provider: 'openai', prompt: '' } },
      { id: 'n4', type: 'trigger-manual', data: { label: 'Valid Start' } },
    ];

    const validation = NodeValidator.validateWorkflow(invalidNodes, []);
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.issues.length, 3);
    assert.strictEqual(validation.issues[0].nodeId, 'n1');
    assert.strictEqual(validation.issues[0].error, 'HTTP URL is required');
    assert.strictEqual(validation.issues[1].nodeId, 'n2');
    assert.strictEqual(validation.issues[2].nodeId, 'n3');

    // Valid workflow
    const validNodes = [
      { id: 'n1', type: NodeTypes.ACTION_HTTP, data: { label: 'Fetch Users', url: 'https://api.example.com/users', method: 'GET' } },
      { id: 'n4', type: 'trigger-manual', data: { label: 'Manual Trigger' } },
    ];

    const validResult = NodeValidator.validateWorkflow(validNodes, []);
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.issues.length, 0);
  });

  it('Node Palette: provides 30 canonical items, category groupings, and search descriptions', () => {
    const entries = Object.entries(NODE_DEFS);
    assert.strictEqual(entries.length, 30, 'Palette must contain exactly 30 canonical nodes');

    // Verify all nodes have descriptions
    for (const [key, def] of entries) {
      assert.ok(def.description, `Node ${key} should have a description`);
      assert.ok(typeof def.description === 'string' && def.description.length > 5);
      assert.ok(['trigger', 'action', 'logic', 'ai'].includes(def.category));
    }

    // Verify search matching
    const q = 'cron';
    const matches = entries.filter(([type, def]) =>
      def.label.toLowerCase().includes(q) ||
      type.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q)
    );
    assert.ok(matches.some(([type]) => type === 'trigger-schedule'));
  });
});

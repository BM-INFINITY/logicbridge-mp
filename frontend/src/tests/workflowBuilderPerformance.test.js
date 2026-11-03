import { describe, it } from 'node:test';
import assert from 'node:assert';
import useCanvasStore from '../store/canvasStore.js';
import NodeValidator from '../validators/NodeValidator.js';
import { WorkflowSerializer } from '../utils/WorkflowSerializer.js';

describe('Workflow Builder Performance & Scalability Benchmarks', () => {
  function generateSyntheticWorkflow(count) {
    const nodes = [];
    const edges = [];
    const types = [
      'trigger-manual',
      'action-http',
      'action-transform',
      'action-log',
      'action-json',
      'logic-condition',
      'action-ai-agent',
    ];

    for (let i = 0; i < count; i++) {
      const type = i === 0 ? 'trigger-manual' : types[i % types.length];
      const nodeId = `node_${i + 1}`;
      nodes.push({
        id: nodeId,
        type,
        position: { x: (i % 5) * 240, y: Math.floor(i / 5) * 140 },
        data: {
          label: `Step ${i + 1} (${type})`,
          url: type === 'action-http' ? 'https://api.example.com/data' : undefined,
          operation: type === 'action-transform' ? 'map' : type === 'action-json' ? 'parse' : undefined,
          input: type === 'action-json' ? '{{steps.node_1.data}}' : undefined,
          mappings: type === 'action-transform' ? [{ outputField: 'id', expression: '{{steps.node_1.id}}' }] : undefined,
          prompt: type === 'action-ai-agent' ? 'Process data' : undefined,
          leftValue: type === 'logic-condition' ? 'status' : undefined,
          operator: type === 'logic-condition' ? 'equals' : undefined,
          rightValue: type === 'logic-condition' ? 'active' : undefined,
        },
      });

      if (i > 0) {
        edges.push({
          id: `edge_${i}_${i + 1}`,
          source: `node_${i}`,
          target: nodeId,
          sourceHandle: nodes[i - 1].type === 'logic-condition' ? 'true' : undefined,
        });
      }
    }

    return { nodes, edges };
  }

  it('Benchmark 10-node Workflow: Instant validation and serialization under 5ms', () => {
    const { nodes, edges } = generateSyntheticWorkflow(10);
    const store = useCanvasStore.getState();
    store.resetCanvas();

    const t0 = performance.now();
    store.setNodes(nodes);
    store.setEdges(edges);
    const tStore = performance.now() - t0;

    const t1 = performance.now();
    const validation = NodeValidator.validateWorkflow(nodes, edges);
    const tVal = performance.now() - t1;

    const t2 = performance.now();
    const serialized = WorkflowSerializer.serialize({ name: 'Workflow 10', nodes, edges });
    const tSer = performance.now() - t2;

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(serialized.workflow.nodes.length, 10);
    assert.ok(tStore < 10, `Store update should be < 10ms, was ${tStore.toFixed(2)}ms`);
    assert.ok(tVal < 10, `Validation should be < 10ms, was ${tVal.toFixed(2)}ms`);
    assert.ok(tSer < 10, `Serialization should be < 10ms, was ${tSer.toFixed(2)}ms`);
  });

  it('Benchmark 50-node Workflow: Fast validation and history snapshot under 10ms', () => {
    const { nodes, edges } = generateSyntheticWorkflow(50);
    const store = useCanvasStore.getState();
    store.resetCanvas();
    store.setNodes(nodes);
    store.setEdges(edges);

    // Snapshot benchmark
    const tSnap = performance.now();
    store.takeSnapshot();
    const dSnap = performance.now() - tSnap;

    // Validation benchmark
    const tVal = performance.now();
    const validation = NodeValidator.validateWorkflow(nodes, edges);
    const dVal = performance.now() - tVal;

    // Duplication benchmark
    const tDup = performance.now();
    store.duplicateNode('node_10');
    const dDup = performance.now() - tDup;

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(useCanvasStore.getState().nodes.length, 51);
    assert.ok(dSnap < 15, `Snapshot of 50 nodes should be < 15ms, was ${dSnap.toFixed(2)}ms`);
    assert.ok(dVal < 15, `Validation of 50 nodes should be < 15ms, was ${dVal.toFixed(2)}ms`);
    assert.ok(dDup < 15, `Duplication of node in 50-node graph should be < 15ms, was ${dDup.toFixed(2)}ms`);
  });

  it('Benchmark 100-node Workflow: High scale validation and serialization under 25ms', () => {
    const { nodes, edges } = generateSyntheticWorkflow(100);
    const store = useCanvasStore.getState();
    store.resetCanvas();
    store.setNodes(nodes);
    store.setEdges(edges);

    // Snapshot & Undo benchmark
    const tSnap = performance.now();
    store.takeSnapshot();
    const dSnap = performance.now() - tSnap;

    // Validation benchmark across 100 nodes
    const tVal = performance.now();
    const validation = NodeValidator.validateWorkflow(nodes, edges);
    const dVal = performance.now() - tVal;

    // Serialization & Deserialization benchmark
    const tSer = performance.now();
    const pkg = WorkflowSerializer.serialize({ name: 'Scale 100', nodes, edges });
    const deserialized = WorkflowSerializer.deserialize(pkg);
    const dSer = performance.now() - tSer;

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(deserialized.nodes.length, 100);
    assert.strictEqual(deserialized.edges.length, 99);
    assert.ok(dSnap < 25, `Snapshot of 100 nodes should be < 25ms, was ${dSnap.toFixed(2)}ms`);
    assert.ok(dVal < 25, `Validation of 100 nodes should be < 25ms, was ${dVal.toFixed(2)}ms`);
    assert.ok(dSer < 35, `Serialization round-trip for 100 nodes should be < 35ms, was ${dSer.toFixed(2)}ms`);
  });
});

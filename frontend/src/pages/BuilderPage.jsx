import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useNodesState, useEdgesState } from 'reactflow';
import toast from 'react-hot-toast';
import useWorkflowStore from '../store/workflowStore';
import useCanvasStore from '../store/canvasStore';
import useReplayStore from '../store/replayStore';
import { NODE_DEFS } from '../data/templates';
import ReactFlowAdapter from '../adapters/ReactFlowAdapter';
import ReplayCanvasAdapter from '../adapters/ReplayCanvasAdapter';
import { BuilderProvider } from '../context/BuilderContext';
import { Toolbar, Canvas, NodePalette, AIPanel } from '../components/builder';
import TemplatesModal from '../components/TemplatesModal';
import ExecutionPanel from '../components/ExecutionPanel';
import StepEditorSidebar from '../components/StepEditorSidebar';
import { ExecutionTimeline } from '../components/execution';

function BuilderContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchWorkflow, updateWorkflow, runWorkflow } = useWorkflowStore();

  const {
    nodes,
    edges,
    selectedNode,
    showAI,
    showTemplates,
    executionResult,
    setNodes,
    setEdges,
    setSelectedNode,
    setShowTemplates,
    setExecutionResult,
    setRunning,
    setSaving,
    updateNodeData,
    deleteNode,
  } = useCanvasStore();

  const {
    isReplayActive,
    snapshots,
    timelineCursor,
    startReplay,
    stopReplay,
  } = useReplayStore();

  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const wrapperRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  // Load workflow from backend
  useEffect(() => {
    if (id) {
      fetchWorkflow(id).then((wf) => {
        if (wf) {
          setWorkflowName(wf.name);
          setNodes(wf.nodes || []);
          setEdges(wf.edges || []);

          // If navigation requested a replay for a specific execution
          if (location.state?.replayExecution) {
            startReplay(location.state.replayExecution, wf.nodes || []);
          }
        }
      });
    }
  }, [id, location.state]);

  const [, , onNodesChange] = useNodesState([]);
  const [, , onEdgesChange] = useEdgesState([]);

  const handleNodesChange = useCallback(
    (changes) => setNodes((nds) => changes.reduce((acc, change) => {
      if (change.type === 'position' && change.position) {
        return acc.map(n => n.id === change.id ? { ...n, position: change.position } : n);
      }
      return acc;
    }, nds)),
    [setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes) => setEdges((eds) => eds.filter(e => !changes.some(c => c.type === 'remove' && c.id === e.id))),
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => ReactFlowAdapter.connectEdges(params, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type || !rfInstance) return;
      const pos = ReactFlowAdapter.screenToFlowPosition(rfInstance, wrapperRef, e.clientX, e.clientY);
      const def = NODE_DEFS[type];
      const newNode = ReactFlowAdapter.createNodePayload(type, pos, def?.label || type);
      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes]
  );

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateWorkflow(id, { name: workflowName, nodes, edges, status: 'active' });
      toast.success('Saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!id) return;
    if (isReplayActive) stopReplay();

    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: 'running' } })));
    setExecutionResult(null);
    setRunning(true);
    toast.loading('Running workflow...', { id: 'run' });
    try {
      await updateWorkflow(id, {
        name: workflowName,
        nodes: nodes.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })),
        edges,
        status: 'active',
      });
      const result = await runWorkflow(id);
      setExecutionResult(result);
      const stepMap = {};
      (result.steps || []).forEach((s) => { stepMap[s.nodeId] = s.status; });
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: stepMap[n.id] || undefined } })));
      toast.success(result.status === 'success' ? 'Workflow succeeded!' : 'Workflow failed', { id: 'run' });
    } catch {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })));
      toast.error('Execution error', { id: 'run' });
    } finally {
      setRunning(false);
    }
  };

  const loadTemplate = (t) => {
    setWorkflowName(t.name);
    setNodes(t.nodes);
    setEdges(t.edges);
    setExecutionResult(null);
    setSelectedNode(null);
    if (isReplayActive) stopReplay();
    toast.success(`Template "${t.name}" loaded! Click Run to see results.`);
  };

  // ── Compute Replay Canvas Transformation via ReplayCanvasAdapter ───────────
  let displayNodes = nodes;
  let displayEdges = edges;

  if (isReplayActive && snapshots.length > 0) {
    const currentSnapshot = snapshots[timelineCursor.index];
    const transformed = ReplayCanvasAdapter.applySnapshotToCanvas(nodes, edges, currentSnapshot);
    displayNodes = transformed.nodes;
    displayEdges = transformed.edges;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        onBack={() => navigate('/dashboard')}
        onSave={handleSave}
        onRun={handleRun}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <NodePalette />

        {/* Canvas displaying adapter-transformed nodes & edges */}
        <Canvas
          onInit={setRfInstance}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNode(node)}
          onPaneClick={() => setSelectedNode(null)}
          onDrop={onDrop}
          wrapperRef={wrapperRef}
          displayNodes={displayNodes}
          displayEdges={displayEdges}
        />

        {showAI && (
          <AIPanel
            onGenerate={(r) => {
              setNodes(r.nodes || []);
              setEdges(r.edges || []);
              if (r.name) setWorkflowName(r.name);
            }}
          />
        )}

        {selectedNode && !showAI && (
          <StepEditorSidebar
            node={nodes.find((n) => n.id === selectedNode.id)}
            nodes={nodes}
            edges={edges}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
            workflowId={id}
          />
        )}

        {executionResult && !isReplayActive && (
          <ExecutionPanel
            execution={executionResult}
            onClose={() => {
              setExecutionResult(null);
              setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })));
            }}
            onStartReplay={(exec) => startReplay(exec, nodes)}
          />
        )}

        {/* Replay Timeline Overlay */}
        <ExecutionTimeline />
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onLoad={loadTemplate} />}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <BuilderProvider>
      <BuilderContent />
    </BuilderProvider>
  );
}

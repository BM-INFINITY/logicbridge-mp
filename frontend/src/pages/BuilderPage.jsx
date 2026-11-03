import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import useWorkflowStore from '../store/workflowStore';
import useCanvasStore from '../store/canvasStore';
import useReplayStore from '../store/replayStore';
import { NODE_DEFS, TEMPLATES } from '../data/templates';
import { normalizeNodeType } from '../constants/NodeTypes.js';
import ReactFlowAdapter from '../adapters/ReactFlowAdapter';
import ReplayCanvasAdapter from '../adapters/ReplayCanvasAdapter';
import { BuilderProvider } from '../context/BuilderContext';
import { Toolbar, Canvas, NodePalette, AIPanel, ValidationDrawer } from '../components/builder';
import TemplatesModal from '../components/TemplatesModal';
import ExecutionPanel from '../components/ExecutionPanel';
import StepEditorSidebar from '../components/StepEditorSidebar';
import VariablesModal from '../components/VariablesModal';
import ApprovalsModal from '../components/ApprovalsModal';
import ScheduleModal from '../components/ScheduleModal';
import WebhookEventsModal from '../components/WebhookEventsModal';
import { ExecutionTimeline } from '../components/execution';
import { instantiateTemplate } from '../utils';

function BuilderContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchWorkflow, updateWorkflow, createWorkflow, runWorkflow } = useWorkflowStore();

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
    takeSnapshot,
    undo,
    redo,
    copySelected,
    pasteNodes,
    duplicateNode,
    selectAllNodes,
    deselectAll,
    deleteSelectedNodes,
    showValidationDrawer,
    setShowValidationDrawer,
  } = useCanvasStore();

  const {
    isReplayActive,
    snapshots,
    timelineCursor,
    startReplay,
    stopReplay,
  } = useReplayStore();

  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isDirty, setIsDirty] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showWebhookEvents, setShowWebhookEvents] = useState(false);
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
          setIsDirty(false);

          // If navigation requested a replay for a specific execution
          if (location.state?.replayExecution) {
            startReplay(location.state.replayExecution, wf.nodes || []);
          }
        }
      });
    } else {
      // Query parameters preview support for headless testbed & screenshots
      const params = new URLSearchParams(location.search);
      const templateId = params.get('template');
      const isDirtyParam = params.get('dirty');
      const showVal = params.get('validation');

      if (templateId === 'ai-agent-demo') {
        setWorkflowName('AI Agent & Tool Calling');
        setNodes([
          { id: 't1', type: 'trigger-manual', position: { x: 100, y: 150 }, data: { label: 'User Request' } },
          { id: 'a1', type: 'action-ai-agent', position: { x: 380, y: 150 }, data: { label: 'Customer Support Agent', provider: 'openai', model: 'gpt-4o', prompt: 'Analyze incoming customer issue and query account status', tools: ['http_request', 'query_db'] } },
          { id: 'l1', type: 'action-log', position: { x: 680, y: 150 }, data: { label: 'Resolution Log', message: 'Resolved successfully' } },
        ]);
        setEdges([
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'l1' },
        ]);
      } else if (templateId === 'loop-demo') {
        setWorkflowName('Batch Processing Loop');
        setNodes([
          { id: 't1', type: 'trigger-manual', position: { x: 100, y: 150 }, data: { label: 'Start Batch' } },
          { id: 'loop1', type: 'action-loop', position: { x: 380, y: 150 }, data: { label: 'Process Items', operation: 'loop_items', items: '{{steps.t1.items}}', _iterationProgress: 'Item 4 / 10' } },
          { id: 'h1', type: 'action-http', position: { x: 680, y: 80 }, data: { label: 'Process Item (HTTP)', url: 'https://api.example.com/item' } },
          { id: 'done1', type: 'action-log', position: { x: 680, y: 240 }, data: { label: 'Batch Complete', message: 'Done' } },
        ]);
        setEdges([
          { id: 'e1', source: 't1', target: 'loop1' },
          { id: 'e2', source: 'loop1', sourceHandle: 'loop', target: 'h1' },
          { id: 'e3', source: 'loop1', sourceHandle: 'done', target: 'done1' },
        ]);
      } else if (templateId) {
        const t = TEMPLATES.find((tpl) => tpl.id === templateId);
        if (t) {
          const instantiated = instantiateTemplate(t);
          setWorkflowName(instantiated.name);
          setNodes(instantiated.nodes);
          setEdges(instantiated.edges);
        }
      }

      if (isDirtyParam === '1') {
        setIsDirty(true);
      }
      if (showVal === '1') {
        setShowValidationDrawer(true);
      }
    }
  }, [id, location.state, location.search]);

  // Support selecting a node by type or ID from query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectNodeKey = params.get('selectNode');
    if (selectNodeKey && nodes.length > 0) {
      const match = nodes.find((n) => n.id === selectNodeKey || n.type === selectNodeKey);
      if (match) {
        setSelectedNode(match);
      }
    }
  }, [location.search, nodes]);

  const handleNodesChange = useCallback(
    (changes) => {
      setIsDirty(true);
      setNodes((nds) => changes.reduce((acc, change) => {
        if (change.type === 'position' && change.position) {
          return acc.map(n => n.id === change.id ? { ...n, position: change.position } : n);
        }
        if (change.type === 'select') {
          return acc.map(n => n.id === change.id ? { ...n, selected: change.selected } : n);
        }
        return acc;
      }, nds));
    },
    [setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      setIsDirty(true);
      setEdges((eds) => eds.filter(e => !changes.some(c => c.type === 'remove' && c.id === e.id)));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => {
      takeSnapshot();
      setIsDirty(true);
      setEdges((eds) => ReactFlowAdapter.connectEdges(params, eds));
    },
    [setEdges, takeSnapshot]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const rawType = e.dataTransfer.getData('application/reactflow');
      if (!rawType || !rfInstance) return;
      takeSnapshot();
      const type = normalizeNodeType(rawType);
      const pos = ReactFlowAdapter.screenToFlowPosition(rfInstance, wrapperRef, e.clientX, e.clientY);
      const def = NODE_DEFS[type];
      const newNode = ReactFlowAdapter.createNodePayload(type, pos, def?.label || type);
      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
      setIsDirty(true);
    },
    [rfInstance, setNodes, setSelectedNode, takeSnapshot]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id) {
        await updateWorkflow(id, { name: workflowName, nodes, edges, status: 'active' });
        setIsDirty(false);
        toast.success('Saved!');
      } else {
        const newWf = await createWorkflow({ name: workflowName, nodes, edges, status: 'active' });
        setIsDirty(false);
        toast.success('Workflow created and saved!');
        navigate(`/builder/${newWf._id}`, { replace: true });
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    let currentId = id;
    if (isReplayActive) stopReplay();

    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: 'running' } })));
    setExecutionResult(null);
    setRunning(true);
    toast.loading('Running workflow...', { id: 'run' });
    try {
      if (!currentId) {
        const newWf = await createWorkflow({
          name: workflowName,
          nodes: nodes.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })),
          edges,
          status: 'active',
        });
        currentId = newWf._id;
        navigate(`/builder/${newWf._id}`, { replace: true });
      } else {
        await updateWorkflow(currentId, {
          name: workflowName,
          nodes: nodes.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })),
          edges,
          status: 'active',
        });
      }
      const result = await runWorkflow(currentId);
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

  const loadTemplate = (t, installConfig = {}) => {
    takeSnapshot();
    const instantiated = instantiateTemplate(t, installConfig);
    setWorkflowName(instantiated.name);
    setNodes(instantiated.nodes);
    setEdges(instantiated.edges);
    setExecutionResult(null);
    setSelectedNode(null);
    if (isReplayActive) stopReplay();
    toast.success(`Template "${instantiated.name}" loaded! Click Run to see results.`);
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

  // ── Global Keyboard Shortcuts with Text Input Guard ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Input guard: never intercept typing when user focuses input/textarea/monaco
      const target = e.target;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest?.('.monaco-editor'));

      // Ctrl+S / Cmd+S: Save workflow (works even when input focused if desirable, but safe globally)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // If user is editing text in an input or code editor, skip canvas shortcut actions
      if (isInput) return;

      // Undo: Ctrl+Z (or Cmd+Z without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy: Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const count = copySelected();
        if (count > 0) {
          toast.success(`Copied ${count} ${count === 1 ? 'node' : 'nodes'}`);
        }
        return;
      }

      // Paste: Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const pasted = pasteNodes({ x: 40, y: 40 });
        if (pasted.length > 0) {
          toast.success(`Pasted ${pasted.length} ${pasted.length === 1 ? 'node' : 'nodes'}`);
        }
        return;
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNode) {
          duplicateNode(selectedNode.id, { x: 40, y: 40 });
          toast.success('Node duplicated');
        }
        return;
      }

      // Select All: Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllNodes();
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const deletedCount = deleteSelectedNodes();
        if (deletedCount > 0) {
          toast.success(`Deleted ${deletedCount} ${deletedCount === 1 ? 'node' : 'nodes'}`);
        }
        return;
      }

      // Deselect / Escape
      if (e.key === 'Escape') {
        deselectAll();
        setShowValidationDrawer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    workflowName, nodes, edges, id, selectedNode,
    undo, redo, copySelected, pasteNodes, duplicateNode,
    selectAllNodes, deselectAll, deleteSelectedNodes,
    setShowValidationDrawer,
  ]);

  const handleNavigateToNode = (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNode(node);
    if (rfInstance && node.position) {
      rfInstance.setCenter(node.position.x + 100, node.position.y + 40, { zoom: 1.2, duration: 400 });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar
        isDirty={isDirty}
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        onBack={() => navigate('/dashboard')}
        onSave={handleSave}
        onRun={handleRun}
        onFitView={() => rfInstance?.fitView({ padding: 0.2, duration: 400 })}
        onOpenVariables={() => setShowVariables(true)}
        onOpenApprovals={() => setShowApprovals(true)}
        onOpenSchedules={() => setShowSchedules(true)}
        onOpenWebhookEvents={() => setShowWebhookEvents(true)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <NodePalette />

        {/* Canvas displaying adapter-transformed nodes & edges */}
        <Canvas
          onInit={setRfInstance}
          rfInstance={rfInstance}
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
              takeSnapshot();
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

        {/* Workflow Validation Drawer */}
        <ValidationDrawer
          isOpen={showValidationDrawer}
          onClose={() => setShowValidationDrawer(false)}
          nodes={nodes}
          edges={edges}
          onNavigateToNode={handleNavigateToNode}
        />

        {executionResult && !isReplayActive && (
          <ExecutionPanel
            execution={executionResult}
            onClose={() => {
              setExecutionResult(null);
              setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execStatus: undefined } })));
            }}
            onStartReplay={(exec) => startReplay(exec, nodes)}
            onExecutionUpdate={(updated) => setExecutionResult(updated)}
          />
        )}

        {/* Replay Timeline Overlay */}
        <ExecutionTimeline />
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onLoad={loadTemplate} />}
      <VariablesModal
        isOpen={showVariables}
        onClose={() => setShowVariables(false)}
        workflowId={id}
      />
      <ApprovalsModal
        isOpen={showApprovals}
        onClose={() => setShowApprovals(false)}
        onDecisionMade={(updated) => {
          if (executionResult && executionResult._id === updated?._id) {
            setExecutionResult(updated);
          }
        }}
      />
      <ScheduleModal
        isOpen={showSchedules}
        onClose={() => setShowSchedules(false)}
        workflowId={id}
        workflowName={workflowName}
      />
      <WebhookEventsModal
        isOpen={showWebhookEvents}
        onClose={() => setShowWebhookEvents(false)}
        workflowId={id}
        workflowName={workflowName}
      />
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, ArrowLeft, Trash2, Sparkles, X, LayoutTemplate, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useWorkflowStore from '../store/workflowStore';
import { NODE_DEFS } from '../data/templates';
import TemplatesModal from '../components/TemplatesModal';
import ExecutionPanel from '../components/ExecutionPanel';
import StepEditorSidebar from '../components/StepEditorSidebar';

// ─── Custom Node ─────────────────────────────────────────────────────────────
function CustomNode({ data, selected, type }) {
  const def = NODE_DEFS[type] || { label: type, icon: '⚙️', color: '#6c63ff', category: 'action' };
  const isFirst = def.category === 'trigger';
  const execStatus = data._execStatus; // 'success' | 'failed' | 'running'

  return (
    <div className={`flow-node node-${def.category}`}
      style={{
        borderColor: execStatus === 'success' ? '#22c55e' : execStatus === 'failed' ? '#ef4444' : selected ? def.color : undefined,
        boxShadow: execStatus === 'success' ? '0 0 16px rgba(34,197,94,0.35)' : execStatus === 'failed' ? '0 0 16px rgba(239,68,68,0.35)' : selected ? `0 0 20px ${def.color}40` : undefined,
      }}>
      {!isFirst && <Handle type="target" position={Position.Left} style={{ background: def.color, width: 10, height: 10, border: '2px solid var(--bg-base)' }} />}
      <div className="flow-node-header">
        <div className="flow-node-icon" style={{ background: `${def.color}22`, color: def.color }}>
          <span style={{ fontSize: 14 }}>{def.icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="flow-node-label">{data.label || def.label}</div>
          <div className="flow-node-type">{def.category.toUpperCase()}</div>
        </div>
        {execStatus && (
          <div style={{ marginLeft: 4 }}>
            {execStatus === 'success' && <CheckCircle2 size={14} color="#22c55e" />}
            {execStatus === 'failed' && <XCircle size={14} color="#ef4444" />}
            {execStatus === 'running' && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
          </div>
        )}
      </div>
      {data.url && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{data.url}</div>}
      {data.message && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.message}</div>}
      <Handle type="source" position={Position.Right} style={{ background: def.color, width: 10, height: 10, border: '2px solid var(--bg-base)' }} />
    </div>
  );
}

const nodeTypes = Object.fromEntries(Object.keys(NODE_DEFS).map(k => [k, CustomNode]));

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ onClose, onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { generateFromAI } = useWorkflowStore();
  const handle = async () => {
    if (!prompt.trim()) return toast.error('Enter a description');
    setLoading(true);
    try { onGenerate(await generateFromAI(prompt)); onClose(); toast.success('AI workflow generated! ✨'); }
    catch { toast.error('AI generation failed'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ position: 'absolute', top: 70, right: 16, width: 340, zIndex: 200, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 14, padding: 18, boxShadow: 'var(--shadow-glow)' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} color="#22d3ee" /><span style={{ fontWeight: 600, color: 'var(--accent-secondary)', fontSize: '0.9rem' }}>AI Generator</span></div>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>Describe your automation in plain English:</p>
      <textarea id="ai-prompt" className="form-input form-textarea" style={{ minHeight: 80, marginBottom: 10, fontSize: '0.83rem' }}
        placeholder='"Fetch weather data every hour and log temperature"'
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button id="ai-generate-btn" className="btn btn-primary w-full" style={{ fontSize: '0.85rem', padding: '9px' }} onClick={handle} disabled={loading}>
        {loading ? <><span className="spinner" /> Generating...</> : <><Sparkles size={14} /> Generate Workflow</>}
      </button>
    </div>
  );
}

// ─── Node Config Panel ────────────────────────────────────────────────────────
function NodeConfig({ node, onUpdate, onDelete }) {
  const [data, setData] = useState({ ...node?.data });
  useEffect(() => { setData({ ...node?.data }); }, [node?.id]);
  if (!node) return null;
  const def = NODE_DEFS[node.type] || {};
  const ch = (key, val) => { const u = { ...data, [key]: val }; setData(u); onUpdate(node.id, u); };

  return (
    <div style={{ position: 'absolute', bottom: 16, left: 226, width: 270, zIndex: 100, background: 'var(--bg-elevated)', border: `1px solid ${def.color || 'var(--border)'}40`, borderRadius: 12, padding: 14, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{def.icon}</span> {def.label || node.type}
        </span>
        <button className="btn btn-sm btn-danger" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => onDelete(node.id)}><Trash2 size={11} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="form-group"><label className="form-label">Label</label>
          <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.label || ''} onChange={e => ch('label', e.target.value)} /></div>
        {node.type === 'action-http' && <>
          <div className="form-group"><label className="form-label">URL</label>
            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} placeholder="https://..." value={data.url || ''} onChange={e => ch('url', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Method</label>
            <select className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.method || 'GET'} onChange={e => ch('method', e.target.value)}>
              {['GET','POST','PUT','DELETE'].map(m => <option key={m}>{m}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Body (JSON)</label>
            <textarea className="form-input" style={{ padding: '6px 10px', fontSize: '0.78rem', minHeight: 60 }} placeholder='{"key":"value"}' value={data.body || ''} onChange={e => ch('body', e.target.value)} /></div>
        </>}
        {node.type === 'action-log' && <div className="form-group"><label className="form-label">Message (use {'{{prev}}'} for prev output)</label>
          <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} placeholder="Log message..." value={data.message || ''} onChange={e => ch('message', e.target.value)} /></div>}
        {node.type === 'action-delay' && <div className="form-group"><label className="form-label">Seconds to wait</label>
          <input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.seconds || 1} onChange={e => ch('seconds', Number(e.target.value))} /></div>}
        {node.type === 'action-transform' && <div className="form-group"><label className="form-label">Field mapping (JSON, use {'{{prev.field}}'})</label>
          <textarea className="form-input" style={{ padding: '6px 10px', fontSize: '0.75rem', minHeight: 70, fontFamily: 'monospace' }}
            placeholder={'{"name":"{{prev.name}}","email":"{{prev.email}}"}'} value={data.template || ''} onChange={e => ch('template', e.target.value)} /></div>}
        {node.type === 'trigger-schedule' && <div className="form-group"><label className="form-label">Cron Expression</label>
          <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} placeholder="0 9 * * *" value={data.cron || ''} onChange={e => ch('cron', e.target.value)} /></div>}
        {node.type === 'logic-condition' && <>
          <div className="form-group"><label className="form-label">Left Value (or {'{{prev.field}}'})</label>
            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.leftValue || ''} onChange={e => ch('leftValue', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Operator</label>
            <select className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.operator || 'equals'} onChange={e => ch('operator', e.target.value)}>
              {['equals','not-equals','contains','greater-than','less-than'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Right Value</label>
            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={data.rightValue || ''} onChange={e => ch('rightValue', e.target.value)} /></div>
        </>}
        {node.type === 'action-csv' && <>
          <div className="form-group">
            <label className="form-label">Fields to extract (comma-separated)</label>
            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', fontFamily: 'monospace' }}
              placeholder="Station,Temperature" value={data.fields || 'Station,Temperature'} onChange={e => ch('fields', e.target.value)} />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>IMD fields: Station, Temperature, Humidity, Wind Speed, Date of Observation</div>
          </div>
          <div className="form-group">
            <label className="form-label">Filename (without .csv)</label>
            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              placeholder="weather_report" value={data.filename || 'weather_report'} onChange={e => ch('filename', e.target.value)} />
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── Node Palette ─────────────────────────────────────────────────────────────
function NodePalette() {
  const onDragStart = (e, type) => { e.dataTransfer.setData('application/reactflow', type); e.dataTransfer.effectAllowed = 'move'; };
  return (
    <div className="node-palette" style={{ width: 210, zIndex: 10, overflowY: 'auto' }}>
      <div style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Node Palette</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>Drag onto canvas →</div>
      {['trigger','action','logic'].map(cat => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div className="palette-section-title">{cat === 'trigger' ? 'Triggers' : cat === 'action' ? 'Actions' : 'Logic'}</div>
          {Object.entries(NODE_DEFS).filter(([,d]) => d.category === cat).map(([type, def]) => (
            <div key={type} className="palette-node" draggable onDragStart={e => onDragStart(e, type)}>
              <div className="palette-node-icon" style={{ background: `${def.color}20`, color: def.color }}><span style={{ fontSize: 12 }}>{def.icon}</span></div>
              <span style={{ fontSize: '0.78rem' }}>{def.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchWorkflow, updateWorkflow, runWorkflow } = useWorkflowStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [execution, setExecution] = useState(null); // last execution result
  const wrapperRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  useEffect(() => {
    if (id) fetchWorkflow(id).then(wf => {
      if (wf) { setWorkflowName(wf.name); setNodes(wf.nodes || []); setEdges(wf.edges || []); }
    });
  }, [id]);

  const onConnect = useCallback(params =>
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#6c63ff', strokeWidth: 2 } }, eds)), []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !rfInstance) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const def = NODE_DEFS[type];
    setNodes(nds => [...nds, { id: `node_${Date.now()}`, type, position: pos, data: { label: def?.label || type } }]);
  }, [rfInstance]);

  const onDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onNodeClick = (_, node) => setSelectedNode(node);
  const onPaneClick = () => setSelectedNode(null);

  const updateNodeData = (nodeId, data) =>
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data } : n));

  const deleteNode = nodeId => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try { await updateWorkflow(id, { name: workflowName, nodes, edges, status: 'active' }); toast.success('Saved!'); }
    catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const handleRun = async () => {
    if (!id) return;
    // Show running status on all nodes
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _execStatus: 'running' } })));
    setExecution(null);
    setRunning(true);
    toast.loading('Running workflow...', { id: 'run' });
    try {
      await updateWorkflow(id, { name: workflowName, nodes: nodes.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } })), edges, status: 'active' });
      const result = await runWorkflow(id);
      setExecution(result);
      // Overlay node statuses from step results
      const stepMap = {};
      (result.steps || []).forEach(s => { stepMap[s.nodeId] = s.status; });
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _execStatus: stepMap[n.id] || undefined } })));
      toast.success(result.status === 'success' ? '✅ Workflow succeeded!' : '❌ Workflow failed', { id: 'run' });
    } catch (err) {
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } })));
      toast.error('Execution error', { id: 'run' });
    } finally { setRunning(false); }
  };

  const loadTemplate = t => {
    setWorkflowName(t.name);
    setNodes(t.nodes);
    setEdges(t.edges);
    setExecution(null);
    setSelectedNode(null);
    toast.success(`Template "${t.name}" loaded! Click Run to see results.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="builder-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}><ArrowLeft size={15} /> Back</button>
          <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
          <input value={workflowName} onChange={e => setWorkflowName(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', width: 200 }} />
          {nodes.length > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 6, padding: '2px 8px' }}>{nodes.length} nodes</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowTemplates(true); setShowAI(false); }}>
            <LayoutTemplate size={14} /> Templates
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowAI(!showAI); setShowTemplates(false); }}>
            <Sparkles size={14} color="#22d3ee" /> AI Generate
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : '💾'} Save
          </button>
          <button id="run-workflow-btn" className="btn btn-primary btn-sm" onClick={handleRun} disabled={running || nodes.length === 0}>
            {running ? <><span className="spinner" /> Running...</> : <><Play size={14} /> Run</>}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <NodePalette />
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
            onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            onInit={setRfInstance} nodeTypes={nodeTypes} fitView
            style={{ background: 'var(--bg-base)' }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#6c63ff', strokeWidth: 2 } }}>
            <Background color="#1e2332" gap={24} size={1.5} />
            <Controls style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <MiniMap style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }} nodeColor="#6c63ff" />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 5 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Start building your workflow</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Drag nodes from the palette · or load a <strong style={{ color: 'var(--accent-primary)' }}>Template</strong> · or use <strong style={{ color: '#22d3ee' }}>AI Generate</strong></div>
            </div>
          )}

          {showAI && <AIPanel onClose={() => setShowAI(false)} onGenerate={r => { setNodes(r.nodes || []); setEdges(r.edges || []); if (r.name) setWorkflowName(r.name); }} />}
          {selectedNode && !showAI && (
            <StepEditorSidebar
              node={nodes.find(n => n.id === selectedNode.id)}
              nodes={nodes}
              edges={edges}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              onClose={() => setSelectedNode(null)}
              workflowId={id}
            />
          )}
        </div>

        {/* Execution results panel */}
        {execution && <ExecutionPanel execution={execution} onClose={() => { setExecution(null); setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _execStatus: undefined } }))); }} />}
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onLoad={loadTemplate} />}
    </div>
  );
}

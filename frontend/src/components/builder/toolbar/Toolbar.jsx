import React from 'react';
import { ArrowLeft, LayoutTemplate, Sparkles, Play } from 'lucide-react';
import useCanvasStore from '../../../store/canvasStore';

export default function Toolbar({
  workflowName,
  setWorkflowName,
  onBack,
  onSave,
  onRun,
}) {
  const { nodes, running, saving, showAI, setShowAI, showTemplates, setShowTemplates } = useCanvasStore();

  return (
    <div className="builder-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            width: 200,
          }}
        />
        {nodes.length > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 6, padding: '2px 8px' }}>
            {nodes.length} nodes
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setShowTemplates(!showTemplates);
            setShowAI(false);
          }}
        >
          <LayoutTemplate size={14} /> Templates
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setShowAI(!showAI);
            setShowTemplates(false);
          }}
        >
          <Sparkles size={14} color="#22d3ee" /> AI Generate
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? <span className="spinner" /> : '💾'} Save
        </button>
        <button
          id="run-workflow-btn"
          className="btn btn-primary btn-sm"
          onClick={onRun}
          disabled={running || nodes.length === 0}
        >
          {running ? <><span className="spinner" /> Running...</> : <><Play size={14} /> Run</>}
        </button>
      </div>
    </div>
  );
}

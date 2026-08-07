import React from 'react';
import { X, AlertTriangle, FileCode, Layers, GitBranch, Zap } from 'lucide-react';

export default function ImportModal({ previewData, onConfirm, onClose }) {
  if (!previewData) return null;

  const { manifest, workflow, statistics, exportedAt, warnings = [] } = previewData;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: 480, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCode size={20} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Import Workflow Preview</h3>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Workflow Name Badge */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {workflow?.name || 'Untitled Workflow'}
          </div>
          {workflow?.description && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {workflow.description}
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border)' }}>
            <Layers size={14} color="#6c63ff" style={{ marginBottom: 4 }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{statistics?.nodeCount ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NODES</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border)' }}>
            <GitBranch size={14} color="#22c55e" style={{ marginBottom: 4 }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{statistics?.edgeCount ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>EDGES</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border)' }}>
            <Zap size={14} color="#22d3ee" style={{ marginBottom: 4 }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{statistics?.triggerCount ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TRIGGERS</div>
          </div>
        </div>

        {/* Manifest details */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div><strong>Schema Version:</strong> {manifest?.schemaVersion || '1.0.0'}</div>
          <div><strong>Exported At:</strong> {exportedAt ? new Date(exportedAt).toLocaleString() : 'N/A'}</div>
          {manifest?.generatedBy && <div><strong>Generator:</strong> {manifest.generatedBy}</div>}
        </div>

        {/* Warnings list */}
        {warnings.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertTriangle size={14} /> Warnings:
            </div>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>• {w}</div>
            ))}
          </div>
        )}

        {/* Import Mode Selection Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1, padding: '10px' }}
            onClick={() => onConfirm('new')}
          >
            Import as New
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, padding: '10px' }}
            onClick={() => onConfirm('overwrite')}
          >
            Overwrite Canvas
          </button>
        </div>
      </div>
    </div>
  );
}

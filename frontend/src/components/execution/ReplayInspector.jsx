import React from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, Database, Braces } from 'lucide-react';
import useReplayStore from '../../store/replayStore';

const STATUS_BADGE = {
  success: { label: 'Success', color: 'var(--accent-success)', icon: <CheckCircle2 size={13} color="#22c55e" /> },
  failed:  { label: 'Failed',  color: 'var(--accent-danger)',  icon: <XCircle size={13} color="#ef4444" /> },
  skipped: { label: 'Skipped', color: 'var(--accent-warning)', icon: <AlertCircle size={13} color="#f59e0b" /> },
  running: { label: 'Running', color: 'var(--accent-secondary)', icon: <span className="spinner" style={{ width: 10, height: 10 }} /> },
  pending: { label: 'Pending', color: 'var(--text-muted)',     icon: null },
};

/**
 * ReplayInspector — detailed inspector panel displaying inputs, outputs, duration, status, and errors for the selected node step.
 */
export default function ReplayInspector({ onClose }) {
  const { snapshots, timelineCursor, inspectorNodeId } = useReplayStore();

  const currentSnapshot = snapshots[timelineCursor.index] || null;

  // Find step data matching inspectorNodeId from current snapshot or step list
  const step = inspectorNodeId
    ? snapshots.find((s) => s.nodeId === inspectorNodeId && s.input) || currentSnapshot
    : currentSnapshot;

  if (!step) {
    return (
      <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        Select a node to inspect payload.
      </div>
    );
  }

  const badge = STATUS_BADGE[step.status] || STATUS_BADGE.pending;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            {step.nodeName}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>
              {step.nodeType}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: badge.color, fontWeight: 600 }}>
              {badge.icon} {badge.label}
            </span>
            {step.duration > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} /> {step.duration}ms
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Error alert */}
        {step.error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            color: 'var(--accent-danger)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}>
            <strong>Error:</strong> {step.error}
          </div>
        )}

        {/* Inputs */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={11} /> Inputs
          </div>
          <pre style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
            overflow: 'auto',
            maxHeight: 160,
            lineHeight: 1.4,
            margin: 0,
            fontFamily: 'monospace',
          }}>
            {step.input ? JSON.stringify(step.input, null, 2) : 'No inputs recorded'}
          </pre>
        </div>

        {/* Outputs */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Braces size={11} /> Outputs
          </div>
          <pre style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '0.75rem',
            color: step.status === 'skipped' ? 'var(--accent-warning)' : 'var(--accent-secondary)',
            overflow: 'auto',
            maxHeight: 200,
            lineHeight: 1.4,
            margin: 0,
            fontFamily: 'monospace',
          }}>
            {step.output ? JSON.stringify(step.output, null, 2) : 'No output produced'}
          </pre>
        </div>
      </div>
    </div>
  );
}

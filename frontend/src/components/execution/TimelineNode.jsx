import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader, Circle } from 'lucide-react';
import { NODE_DEFS } from '../../data/templates';

const STATUS_CONFIG = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: <CheckCircle2 size={12} color="#22c55e" /> },
  failed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: <XCircle size={12} color="#ef4444" /> },
  skipped: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: <AlertCircle size={12} color="#f59e0b" /> },
  running: { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.4)', icon: <Loader size={12} color="#22d3ee" className="spin" /> },
  pending: { color: '#64748b', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', icon: <Circle size={12} color="#64748b" /> },
};

/**
 * TimelineNode — individual node chip rendered in the timeline progress bar.
 */
export default function TimelineNode({ snapshot, index, isSelected, isActive, onClick }) {
  const status = snapshot?.status || 'pending';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const def = NODE_DEFS[snapshot?.nodeType] || { icon: '⚙️', label: snapshot?.nodeName };

  return (
    <button
      id={`timeline-node-${index}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: isActive ? 'rgba(108,99,255,0.22)' : isSelected ? cfg.bg : 'var(--bg-elevated)',
        border: isActive ? '1.5px solid var(--accent-primary)' : isSelected ? `1.5px solid ${cfg.color}` : `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-full)',
        color: isSelected || isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: '0.75rem',
        fontWeight: isSelected || isActive ? 600 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
        boxShadow: isActive ? '0 0 12px rgba(108,99,255,0.4)' : 'none',
        opacity: status === 'skipped' ? 0.65 : 1,
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>{def.icon || '⚙️'}</span>
      <span>{snapshot?.nodeName || `Step ${index + 1}`}</span>
      {cfg.icon}
      {snapshot?.duration > 0 && (
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 2 }}>
          {snapshot.duration}ms
        </span>
      )}
    </button>
  );
}

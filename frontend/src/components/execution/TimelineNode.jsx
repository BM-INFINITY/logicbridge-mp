import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader, Circle, GitBranch, Repeat, UserCheck, Clock } from 'lucide-react';
import { getNodeIcon } from '../../constants/Icons';

const STATUS_CONFIG = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: <CheckCircle2 size={12} color="#22c55e" /> },
  failed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: <XCircle size={12} color="#ef4444" /> },
  skipped: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: <AlertCircle size={12} color="#f59e0b" /> },
  running: { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.4)', icon: <Loader size={12} color="#22d3ee" className="spin" /> },
  pending: { color: '#64748b', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', icon: <Circle size={12} color="#64748b" /> },
  waiting: { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)', icon: <UserCheck size={12} color="#ec4899" /> },
  paused:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', icon: <Clock size={12} color="#0ea5e9" /> },
};

/**
 * TimelineNode — individual node chip rendered in the timeline progress bar.
 */
export default function TimelineNode({ snapshot, index, isSelected, isActive, onClick }) {
  const status = snapshot?.status || 'pending';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const NodeIcon = getNodeIcon(snapshot?.nodeType);

  // Branch Decision logic
  const isCondition = snapshot?.nodeType === 'logic-condition' || snapshot?.nodeType?.includes('condition');
  const isSwitch = snapshot?.nodeType === 'action-switch' || snapshot?.nodeType === 'logic-switch';
  const isLoop = snapshot?.nodeType === 'action-loop';
  const isApproval = snapshot?.nodeType === 'action-approval';
  const isWait = snapshot?.nodeType === 'action-wait';

  const branchSelected = snapshot?.selectedBranches?.[snapshot.nodeId] || snapshot?.output?.selectedBranch;
  const conditionPassed = snapshot?.output?.passed;
  const loopIterations = snapshot?.output?.iterations ?? snapshot?.output?.currentIndex;
  const loopTotal = snapshot?.output?.total ?? snapshot?.output?.items?.length;

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
      <span style={{ display: 'inline-flex', alignItems: 'center' }}><NodeIcon size={13} color={cfg.color} /></span>
      <span>{snapshot?.nodeName || `Step ${index + 1}`}</span>

      {/* Condition Branch Chip */}
      {isCondition && branchSelected && (
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 4,
            background: conditionPassed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            color: conditionPassed ? '#22c55e' : '#ef4444',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <GitBranch size={9} /> {String(branchSelected).toUpperCase()}
        </span>
      )}

      {/* Switch Case Chip */}
      {isSwitch && branchSelected && (
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(167,139,250,0.2)',
            color: '#a78bfa',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <GitBranch size={9} /> Case {String(branchSelected)}
        </span>
      )}

      {/* Loop Counter Chip */}
      {isLoop && loopIterations !== undefined && (
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(34,211,238,0.2)',
            color: '#22d3ee',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Repeat size={9} /> Iter {loopIterations}{loopTotal ? `/${loopTotal}` : ''}
        </span>
      )}

      {/* Approval Badge */}
      {isApproval && snapshot?.output?.decision && (
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 4,
            background: snapshot.output.decision === 'approved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            color: snapshot.output.decision === 'approved' ? '#22c55e' : '#ef4444',
          }}
        >
          {snapshot.output.decision}
        </span>
      )}

      {/* Wait Badge */}
      {isWait && (
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(14,165,233,0.2)',
            color: '#0ea5e9',
          }}
        >
          Wait {snapshot?.output?.duration || 'Event'}
        </span>
      )}

      {cfg.icon}

      {snapshot?.duration > 0 && (
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 2 }}>
          {snapshot.duration}ms
        </span>
      )}
    </button>
  );
}

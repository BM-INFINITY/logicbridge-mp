import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  UserCheck,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';
import AgentToolCallViewer from './execution/AgentToolCallViewer';

function StepResult({ step, index }) {
  const [open, setOpen] = useState(index === 0);
  const isOk = step.status === 'success';
  const isSkipped = step.status === 'skipped';
  const isFailed = step.status === 'failed';
  const isWaiting = step.status === 'waiting';
  const isPaused = step.status === 'paused';

  const statusBg = isOk
    ? 'rgba(34,197,94,0.05)'
    : isSkipped
    ? 'rgba(245,158,11,0.05)'
    : isWaiting
    ? 'rgba(236,72,153,0.08)'
    : isPaused
    ? 'rgba(14,165,233,0.08)'
    : 'rgba(239,68,68,0.05)';

  const borderClr = isOk
    ? 'rgba(34,197,94,0.2)'
    : isSkipped
    ? 'rgba(245,158,11,0.2)'
    : isWaiting
    ? 'rgba(236,72,153,0.3)'
    : isPaused
    ? 'rgba(14,165,233,0.3)'
    : 'rgba(239,68,68,0.2)';

  return (
    <div style={{ marginBottom: 8, border: `1px solid ${borderClr}`, borderRadius: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: statusBg, cursor: 'pointer' }}
      >
        {isOk && <CheckCircle2 size={16} color="#22c55e" />}
        {isSkipped && <AlertCircle size={16} color="#f59e0b" />}
        {isFailed && <XCircle size={16} color="#ef4444" />}
        {isWaiting && <UserCheck size={16} color="#ec4899" className="animate-pulse" />}
        {isPaused && <Clock size={16} color="#0ea5e9" />}

        <span style={{ fontWeight: 600, fontSize: '0.83rem', flex: 1, color: isSkipped ? 'var(--text-muted)' : 'inherit' }}>
          {step.nodeName} {isSkipped && '(Skipped)'} {isWaiting && '(Waiting Approval)'} {isPaused && '(Paused)'}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 4, padding: '1px 6px' }}>
          {step.nodeType}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{step.duration || 0}ms</span>
        {open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
      </div>

      {open && (
        <div style={{ padding: '12px 14px', background: 'var(--bg-card)', borderTop: `1px solid ${borderClr}` }}>
          {step.error && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={13} /> {step.error}
            </div>
          )}
          {step.output && (
            <div>
              {step.nodeType === 'action-ai-agent' || step.output?.toolCalls ? (
                <AgentToolCallViewer output={step.output} />
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Output Payload
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(step.output, null, 2));
                        toast.success('Output copied');
                      }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                  <pre style={{ fontSize: '0.75rem', color: isSkipped ? '#f59e0b' : '#22d3ee', background: 'var(--bg-elevated)', borderRadius: 6, padding: '10px 12px', overflow: 'auto', maxHeight: 220, lineHeight: 1.5, margin: 0 }}>
                    {JSON.stringify(step.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}

export default function ExecutionPanel({ execution: initialExecution, onClose, onStartReplay, onExecutionUpdate }) {
  const [execution, setExecution] = useState(initialExecution);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!execution) return null;

  const isOk = execution.status === 'success';
  const isFailed = execution.status === 'failed';
  const isWaitingApproval = execution.status === 'waiting_approval';
  const isPaused = execution.status === 'paused';

  const dur = execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : '—';
  const steps = execution.steps || [];

  const handleDecide = async (decision) => {
    setSubmitting(true);
    try {
      const res = await API.post(`/api/executions/approvals/${execution._id}/decide`, {
        decision,
        comments,
      });
      const updated = res.data?.data || res.data;
      setExecution(updated);
      toast.success(decision === 'approved' ? 'Execution Approved & Resumed!' : 'Execution Rejected.');
      if (onExecutionUpdate) onExecutionUpdate(updated);
    } catch (err) {
      toast.error(`Decision error: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    if (!execution.wait?.resumeToken) return;
    navigator.clipboard.writeText(execution.wait.resumeToken);
    setCopiedToken(true);
    toast.success('Resume token copied to clipboard!');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 'min(380px, 100vw)',
        maxWidth: '100vw',
        height: '100%',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        animation: 'fadeInLeft 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOk && <CheckCircle2 size={18} color="#22c55e" />}
            {isFailed && <XCircle size={18} color="#ef4444" />}
            {isWaitingApproval && <UserCheck size={18} color="#ec4899" className="animate-pulse" />}
            {isPaused && <Clock size={18} color="#0ea5e9" />}

            <span>
              {isOk
                ? 'Execution Successful'
                : isWaitingApproval
                ? 'Waiting for Approval'
                : isPaused
                ? 'Execution Paused'
                : 'Execution Failed'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {steps.length} steps · {dur} total
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onStartReplay && isOk && (
            <button
              id="exec-panel-replay-btn"
              className="btn btn-sm btn-primary"
              onClick={() => onStartReplay(execution)}
              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Play size={12} /> Replay
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Interactive Approval Action Box */}
      {isWaitingApproval && (
        <div
          style={{
            margin: '12px 16px 0',
            padding: '12px 14px',
            background: 'rgba(236, 72, 153, 0.08)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserCheck size={16} color="#ec4899" />
            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#ec4899' }}>
              {execution.approval?.title || 'Approval Action Required'}
            </span>
          </div>

          {execution.approval?.message && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: 4 }}>
              {execution.approval.message}
            </div>
          )}

          <input
            type="text"
            className="form-control"
            placeholder="Decision notes..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            style={{ fontSize: '0.75rem', height: 32 }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleDecide('rejected')}
              disabled={submitting}
              style={{
                fontSize: '0.75rem',
                color: '#ef4444',
                borderColor: 'rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
              }}
            >
              <XCircle size={13} style={{ marginRight: 4 }} /> Reject
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleDecide('approved')}
              disabled={submitting}
              style={{
                fontSize: '0.75rem',
                background: '#10b981',
                borderColor: '#10b981',
              }}
            >
              {submitting ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <CheckCircle2 size={13} style={{ marginRight: 4 }} />}
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Paused Wait Details Box */}
      {isPaused && execution.wait?.resumeToken && (
        <div
          style={{
            margin: '12px 16px 0',
            padding: '12px 14px',
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="#0ea5e9" />
            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0ea5e9' }}>
              Waiting for External Resume Event
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Post to resume endpoint to continue execution:
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.25)',
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              color: '#38bdf8',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
              {execution.wait.resumeToken}
            </span>
            <button
              onClick={handleCopyToken}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
              title="Copy Resume Token"
            >
              {copiedToken ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          padding: '10px 20px',
          gap: 12,
          borderBottom: '1px solid var(--border)',
          background: isOk ? 'rgba(34,197,94,0.04)' : isWaitingApproval ? 'rgba(236,72,153,0.04)' : 'rgba(239,68,68,0.04)',
          flexShrink: 0,
          marginTop: isWaitingApproval || isPaused ? 12 : 0,
        }}
      >
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>
            {steps.filter((s) => s.status === 'success').length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Passed</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b' }}>
            {steps.filter((s) => s.status === 'skipped').length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Skipped</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: isWaitingApproval ? '#ec4899' : '#ef4444' }}>
            {isWaitingApproval
              ? steps.filter((s) => s.status === 'waiting').length
              : steps.filter((s) => s.status === 'failed').length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {isWaitingApproval ? 'Waiting' : 'Failed'}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Step-by-Step Results
        </div>
        {steps.map((step, i) => (
          <StepResult key={step.nodeId || i} step={step} index={i} />
        ))}

        {execution.error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem' }}>
            <strong>Error:</strong> {execution.error}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

function StepResult({ step, index }) {
  const [open, setOpen] = useState(index === 0);
  const ok = step.status === 'success';
  const color = ok ? '#22c55e' : '#ef4444';

  return (
    <div style={{ marginBottom: 8, border: `1px solid ${ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: ok ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', cursor: 'pointer' }}>
        {ok ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
        <span style={{ fontWeight: 600, fontSize: '0.83rem', flex: 1 }}>{step.nodeName}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 4, padding: '1px 6px' }}>{step.nodeType}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{step.duration}ms</span>
        {open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
      </div>

      {open && (
        <div style={{ padding: '12px 14px', background: 'var(--bg-card)', borderTop: `1px solid ${ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
          {step.error && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              ❌ {step.error}
            </div>
          )}
          {step.output && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output</div>
              <pre style={{ fontSize: '0.75rem', color: '#22d3ee', background: 'var(--bg-elevated)', borderRadius: 6, padding: '10px 12px', overflow: 'auto', maxHeight: 200, lineHeight: 1.5, margin: 0 }}>
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionPanel({ execution, onClose }) {
  if (!execution) return null;
  const ok = execution.status === 'success';
  const dur = execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : '—';
  const steps = execution.steps || [];

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 380, height: '100%',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'fadeInLeft 0.25s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            {ok ? <CheckCircle2 size={18} color="#22c55e" /> : <XCircle size={18} color="#ef4444" />}
            <span>Execution {ok ? 'Successful' : 'Failed'}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {steps.length} steps · {dur} total
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', padding: '10px 20px', gap: 12, borderBottom: '1px solid var(--border)', background: ok ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', flexShrink: 0 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>{steps.filter(s => s.status === 'success').length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Passed</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{steps.filter(s => s.status === 'failed').length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Failed</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{dur}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</div>
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

import React, { useState, useMemo } from 'react';
import {
  Wrench, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Copy, Check, Cpu, Clock, Layers, Sparkles, Brain, ArrowRight,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Redact sensitive tokens or passwords in objects/strings
 */
function sanitizePayload(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    return data
      .replace(/xox[baprs]-[0-9a-zA-Z]{10,48}/gi, 'xoxb-***[REDACTED]***')
      .replace(/sk-[a-zA-Z0-9_-]{20,64}/gi, 'sk-***[REDACTED]***')
      .replace(/ghp_[a-zA-Z0-9]{36}/gi, 'ghp_***[REDACTED]***')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ***[REDACTED]***');
  }
  if (Array.isArray(data)) {
    return data.map(sanitizePayload);
  }
  if (typeof data === 'object') {
    const copy = {};
    for (const [k, v] of Object.entries(data)) {
      if (/password|token|secret|apiKey|authorization/i.test(k) && typeof v === 'string') {
        copy[k] = '***[REDACTED]***';
      } else {
        copy[k] = sanitizePayload(v);
      }
    }
    return copy;
  }
  return data;
}

export default function AgentToolCallViewer({ output }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [openTools, setOpenTools] = useState({ 0: true });

  if (!output) return null;

  const toolCalls = Array.isArray(output.toolCalls) ? output.toolCalls : [];
  const tokenUsage = output.tokenUsage || output.usage || null;
  const iterations = output.iterations ?? (toolCalls.length > 0 ? toolCalls[toolCalls.length - 1]?.iteration || toolCalls.length : 1);
  const finalAnswer = output.text || output.result || output.content || null;
  const agentThought = output.thought || output.reasoning || null;
  const model = output.model || output.metadata?.model || null;
  const provider = output.provider || output.metadata?.provider || null;

  const toggleTool = (idx) => {
    setOpenTools((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyPayload = (data, idx) => {
    const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Sequence Flow Pipeline Pills ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          overflowX: 'auto',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>Flow:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(108,99,255,0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
          <Brain size={11} /> Think
        </span>
        <ArrowRight size={10} color="var(--text-muted)" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
          <Wrench size={11} /> Tool Call ({toolCalls.length})
        </span>
        <ArrowRight size={10} color="var(--text-muted)" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
          <ShieldCheck size={11} /> Observation
        </span>
        <ArrowRight size={10} color="var(--text-muted)" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
          <Sparkles size={11} /> Response
        </span>
      </div>

      {/* ── Metadata & Metrics Banner ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: 'rgba(108, 99, 255, 0.08)',
          border: '1px solid rgba(108, 99, 255, 0.2)',
          borderRadius: 8,
          padding: '8px 12px',
        }}
      >
        {(provider || model) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <Sparkles size={13} color="var(--accent-primary)" />
            <span><strong>{provider || 'AI'}</strong> {model ? `(${model})` : ''}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Layers size={13} color="#a78bfa" />
          <span><strong>{iterations}</strong> turn{iterations !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Wrench size={13} color="#22d3ee" />
          <span><strong>{toolCalls.length}</strong> tool call{toolCalls.length !== 1 ? 's' : ''}</span>
        </div>

        {tokenUsage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            <Cpu size={13} color="#10b981" />
            <span>
              <strong>{tokenUsage.totalTokens || (tokenUsage.promptTokens + tokenUsage.completionTokens) || '—'}</strong> tokens
              {tokenUsage.promptTokens ? ` (${tokenUsage.promptTokens} in / ${tokenUsage.completionTokens || 0} out)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Agent Reasoning / Thought (if present) ───────────────────────── */}
      {agentThought && (
        <div
          style={{
            background: 'rgba(108, 99, 255, 0.05)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Brain size={14} /> Agent Reasoning & Planning
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {agentThought}
          </div>
        </div>
      )}

      {/* ── Tool Calls Sequence ─────────────────────────────────────────── */}
      {toolCalls.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Tool Execution Sequence ({toolCalls.length})</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sensitive tokens masked</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {toolCalls.map((tc, idx) => {
              const isOpen = Boolean(openTools[idx]);
              const toolName = tc.tool || tc.name || 'Tool';
              const duration = tc.durationMs ? `${tc.durationMs}ms` : null;
              const hasError = tc.status === 'failed' || Boolean(tc.error);
              const sanitizedArgs = sanitizePayload(tc.args);
              const sanitizedResult = sanitizePayload(tc.result ?? tc.output ?? tc.error);
              const turnNum = tc.iteration || idx + 1;

              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: hasError ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => toggleTool(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: isOpen ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    }}
                  >
                    {hasError ? (
                      <XCircle size={14} color="var(--accent-danger)" />
                    ) : (
                      <CheckCircle2 size={14} color="#22c55e" />
                    )}

                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Turn {turnNum}
                    </span>

                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {toolName}
                    </span>

                    {hasError && (
                      <span style={{ fontSize: '0.68rem', color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                        Failed
                      </span>
                    )}

                    {duration && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {duration}
                      </span>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isOpen ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Sub-step: Thought/Reason for this call */}
                      {tc.thought && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid var(--accent-primary)' }}>
                          <strong>Intent:</strong> {tc.thought}
                        </div>
                      )}

                      {/* Arguments */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Input Arguments
                          </span>
                          <button
                            onClick={() => copyPayload(sanitizedArgs, `args-${idx}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {copiedIndex === `args-${idx}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre style={{
                          fontSize: '0.72rem',
                          background: 'var(--bg-card)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          overflowX: 'auto',
                          margin: 0,
                          lineHeight: 1.4,
                          color: '#22d3ee',
                        }}>
                          {JSON.stringify(sanitizedArgs, null, 2)}
                        </pre>
                      </div>

                      {/* Result / Observation */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Tool Observation / Result
                          </span>
                          <button
                            onClick={() => copyPayload(sanitizedResult, `res-${idx}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {copiedIndex === `res-${idx}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre style={{
                          fontSize: '0.72rem',
                          background: 'var(--bg-card)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          overflowX: 'auto',
                          margin: 0,
                          lineHeight: 1.4,
                          color: hasError ? 'var(--accent-danger)' : '#a78bfa',
                        }}>
                          {JSON.stringify(sanitizedResult, null, 2)}
                        </pre>
                      </div>

                      {/* Error Banner if tool call failed */}
                      {hasError && tc.error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: '0.74rem', background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                          <AlertTriangle size={13} />
                          <span><strong>Tool Error:</strong> {tc.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Final Synthesized Response ──────────────────────────────────── */}
      {finalAnswer && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} color="var(--accent-primary)" /> Final Agent Response
            </span>
            <button
              onClick={() => copyPayload(finalAnswer, 'final')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              {copiedIndex === 'final' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
              <span>Copy</span>
            </button>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {typeof finalAnswer === 'string' ? sanitizePayload(finalAnswer) : JSON.stringify(sanitizePayload(finalAnswer), null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}


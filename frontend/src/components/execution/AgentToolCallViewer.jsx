import React, { useState } from 'react';
import {
  Wrench, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Copy, Check, Cpu, Clock, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AgentToolCallViewer({ output }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [openTools, setOpenTools] = useState({ 0: true });

  if (!output) return null;

  const toolCalls = Array.isArray(output.toolCalls) ? output.toolCalls : [];
  const tokenUsage = output.tokenUsage || output.usage || null;
  const iterations = output.iterations ?? (toolCalls.length > 0 ? toolCalls[toolCalls.length - 1]?.iteration || toolCalls.length : 1);
  const finalAnswer = output.text || output.result || output.content || null;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Metrics Banner */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Layers size={13} color="var(--accent-primary)" />
          <span><strong>{iterations}</strong> iteration{iterations !== 1 ? 's' : ''}</span>
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
            </span>
          </div>
        )}
      </div>

      {/* Tool Calls Sequence */}
      {toolCalls.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Tool Execution Trace ({toolCalls.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {toolCalls.map((tc, idx) => {
              const isOpen = Boolean(openTools[idx]);
              const toolName = tc.tool || tc.name || 'Tool';
              const duration = tc.durationMs ? `${tc.durationMs}ms` : null;
              const hasError = tc.status === 'failed' || Boolean(tc.error);

              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: hasError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
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
                      #{idx + 1}
                    </span>

                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {toolName}
                    </span>

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
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Arguments */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Arguments
                          </span>
                          <button
                            onClick={() => copyPayload(tc.args, `args-${idx}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {copiedIndex === `args-${idx}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre style={{
                          fontSize: '0.72rem',
                          background: 'var(--bg-card)',
                          padding: '6px 8px',
                          borderRadius: 6,
                          overflowX: 'auto',
                          margin: 0,
                          lineHeight: 1.4,
                          color: '#22d3ee',
                        }}>
                          {JSON.stringify(tc.args, null, 2)}
                        </pre>
                      </div>

                      {/* Result */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Observation / Result
                          </span>
                          <button
                            onClick={() => copyPayload(tc.result, `res-${idx}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {copiedIndex === `res-${idx}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre style={{
                          fontSize: '0.72rem',
                          background: 'var(--bg-card)',
                          padding: '6px 8px',
                          borderRadius: 6,
                          overflowX: 'auto',
                          margin: 0,
                          lineHeight: 1.4,
                          color: hasError ? 'var(--accent-danger)' : '#a78bfa',
                        }}>
                          {JSON.stringify(tc.result ?? tc.output ?? tc.error, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Final Synthesized Response */}
      {finalAnswer && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Final Agent Response
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
            {typeof finalAnswer === 'string' ? finalAnswer : JSON.stringify(finalAnswer, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}


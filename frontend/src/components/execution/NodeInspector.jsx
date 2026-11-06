import React, { useState } from 'react';
import {
  Database, ArrowDownRight, ArrowUpRight, Cpu, Clock, CheckCircle2,
  XCircle, AlertCircle, UserCheck, Timer, FileText, Braces, Sparkles,
} from 'lucide-react';
import JsonViewer from '../ui/JsonViewer';
import Badge from '../ui/Badge';
import AgentToolCallViewer from './AgentToolCallViewer';
import ErrorDebugger from './ErrorDebugger';

export default function NodeInspector({
  step,
  onNavigateToNode,
  onRetry,
}) {
  const [activeTab, setActiveTab] = useState('output'); // 'output' | 'input' | 'trace' | 'error'

  if (!step) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        Select a step from the execution timeline to inspect input, output, and diagnostic traces.
      </div>
    );
  }

  const isOk = step.status === 'success';
  const isFailed = step.status === 'failed';
  const isSkipped = step.status === 'skipped';
  const isWaiting = step.status === 'waiting';
  const isPaused = step.status === 'paused';

  const isAgent = step.nodeType === 'action-ai-agent' || Boolean(step.output?.toolCalls);
  const isAi = step.nodeType?.startsWith('action-ai');
  const tokenUsage = step.output?.tokenUsage || step.output?.usage || null;
  const aiProvider = step.output?.provider || step.input?.provider || null;
  const aiModel = step.output?.model || step.input?.model || null;

  const durationStr = step.duration !== undefined ? `${step.duration}ms` : '—';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Node Inspector Header */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {isOk && <CheckCircle2 size={16} color="#22c55e" />}
          {isFailed && <XCircle size={16} color="#ef4444" />}
          {isSkipped && <AlertCircle size={16} color="#f59e0b" />}
          {isWaiting && <UserCheck size={16} color="#ec4899" className="animate-pulse" />}
          {isPaused && <Clock size={16} color="#0ea5e9" />}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.86rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={step.nodeName}
            >
              {step.nodeName}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <code>{step.nodeType}</code>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Badge
            variant={isOk ? 'success' : isFailed ? 'danger' : isWaiting ? 'warning' : 'neutral'}
            size="sm"
          >
            {step.status}
          </Badge>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Timer size={11} /> {durationStr}
          </span>
        </div>
      </div>

      {/* AI Metadata Banner (For AI / LLM nodes) */}
      {isAi && (aiProvider || tokenUsage) && (
        <div
          style={{
            padding: '6px 14px',
            background: 'rgba(139, 92, 246, 0.08)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          {aiProvider && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color="#8b5cf6" />
              <span>Provider: <strong style={{ color: 'var(--text-primary)' }}>{aiProvider}</strong></span>
            </div>
          )}
          {aiModel && (
            <div>
              Model: <strong style={{ color: 'var(--text-primary)' }}>{aiModel}</strong>
            </div>
          )}
          {tokenUsage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <Cpu size={11} color="#10b981" />
              <span>
                Tokens: <strong style={{ color: 'var(--text-primary)' }}>
                  {tokenUsage.totalTokens || ((tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0)) || '—'}
                </strong>
                {tokenUsage.promptTokens !== undefined && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: 4 }}>
                    ({tokenUsage.promptTokens} in / {tokenUsage.completionTokens} out)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          padding: '0 8px',
          gap: 4,
        }}
      >
        <button
          onClick={() => setActiveTab('output')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '8px 12px',
            fontSize: '0.74rem',
            fontWeight: activeTab === 'output' ? 600 : 400,
            color: activeTab === 'output' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            borderBottom: activeTab === 'output' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <ArrowUpRight size={13} />
          <span>Output Payload</span>
        </button>

        <button
          onClick={() => setActiveTab('input')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '8px 12px',
            fontSize: '0.74rem',
            fontWeight: activeTab === 'input' ? 600 : 400,
            color: activeTab === 'input' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            borderBottom: activeTab === 'input' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <ArrowDownRight size={13} />
          <span>Resolved Inputs</span>
        </button>

        {isAgent && (
          <button
            onClick={() => setActiveTab('trace')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 12px',
              fontSize: '0.74rem',
              fontWeight: activeTab === 'trace' ? 600 : 400,
              color: activeTab === 'trace' ? '#8b5cf6' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'trace' ? '2px solid #8b5cf6' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={13} color="#8b5cf6" />
            <span>Agent Trace</span>
          </button>
        )}

        {step.error && (
          <button
            onClick={() => setActiveTab('error')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 12px',
              fontSize: '0.74rem',
              fontWeight: activeTab === 'error' ? 600 : 400,
              color: activeTab === 'error' ? 'var(--accent-danger)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'error' ? '2px solid var(--accent-danger)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <XCircle size={13} color="var(--accent-danger)" />
            <span>Diagnostic</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {activeTab === 'output' && (
          <div>
            <JsonViewer
              data={step.output}
              title="Step Execution Output"
              emptyText="No output payload produced for this step"
              maxHeight={360}
            />
          </div>
        )}

        {activeTab === 'input' && (
          <div>
            <JsonViewer
              data={step.input}
              title="Resolved Step Inputs"
              emptyText="No resolved input parameters captured for this step"
              maxHeight={360}
            />
          </div>
        )}

        {activeTab === 'trace' && isAgent && (
          <AgentToolCallViewer output={step.output} />
        )}

        {activeTab === 'error' && step.error && (
          <ErrorDebugger
            step={step}
            onNavigateToNode={onNavigateToNode}
            onRetry={onRetry}
          />
        )}
      </div>
    </div>
  );
}

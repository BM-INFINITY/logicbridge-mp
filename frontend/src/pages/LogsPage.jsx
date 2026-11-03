import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RefreshCw,
  Play, Timer, Clock, Search, X, Copy, Check,
} from 'lucide-react';
import API from '../api/client';
import toast from 'react-hot-toast';
import AppSidebar from '../components/AppSidebar';
import { AgentToolCallViewer } from '../components/execution';

/* ─── Status helpers ─────────────────────────────────────────────────────── */
const STATUS_CLASS = {
  success: 'badge-success',
  failed:  'badge-danger',
  running: 'badge-info',
};

function StatusIcon({ status, size = 14 }) {
  if (status === 'success') return <CheckCircle2 size={size} color="var(--accent-success)" />;
  if (status === 'failed')  return <XCircle      size={size} color="var(--accent-danger)"  />;
  if (status === 'running') return <RefreshCw    size={size} color="var(--accent-secondary)" style={{ animation: 'spin 1s linear infinite' }} />;
  return null;
}

/* ─── Step Row in Execution ──────────────────────────────────────────────── */
function StepDetailRow({ step }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAgent = step.nodeType === 'action-ai-agent' || Boolean(step.output?.toolCalls);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(step.output, null, 2));
    setCopied(true);
    toast.success('Step payload copied');
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        fontFamily: 'inherit',
        fontSize: '0.8rem',
      }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
        <span
          className={`badge ${step.status === 'success' ? 'badge-success' : 'badge-danger'}`}
          style={{ fontSize: '0.65rem' }}
        >
          {step.status}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.nodeName}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({step.nodeType})</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          {step.duration ?? 0}ms
        </span>
      </div>

      {step.error && (
        <div
          style={{
            color: 'var(--accent-danger)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.75rem',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <XCircle size={13} /> {step.error}
        </div>
      )}

      {step.output && (
        <div style={{ marginTop: 8 }}>
          {isAgent ? (
            <div style={{ marginTop: 6 }}>
              <AgentToolCallViewer output={step.output} />
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent-primary)',
                    fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>{expanded ? 'Hide Full Payload' : 'Inspect Output Payload'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {expanded ? (
                <pre
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '0.73rem',
                    color: '#22d3ee',
                    maxHeight: 240,
                    overflow: 'auto',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              ) : (
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.74rem',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'var(--bg-elevated)',
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}
                >
                  {JSON.stringify(step.output).slice(0, 140)}...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Execution Row ──────────────────────────────────────────────────────── */
function ExecutionRow({ exec }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dur  = exec.duration ? `${(exec.duration / 1000).toFixed(2)}s` : '—';
  const time = new Date(exec.startedAt).toLocaleString();
  const wfId = exec.workflow?._id || exec.workflow;
  const wfName = exec.workflow?.name || 'Workflow';

  return (
    <div className="step-log" style={{ cursor: 'pointer', marginBottom: 10 }} onClick={() => setOpen(!open)}>
      <div className="step-log-header">
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown size={16} color="var(--text-muted)" />
            : <ChevronRight size={16} color="var(--text-muted)" />}
          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {wfName}
          </span>
          <span className={`badge ${STATUS_CLASS[exec.status] || 'badge-muted'}`}>
            <StatusIcon status={exec.status} size={11} />
            {exec.status}
          </span>
          {exec.trigger && <span className="badge badge-muted">{exec.trigger}</span>}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          {wfId && (
            <button
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/builder/${wfId}`, { state: { replayExecution: exec } });
              }}
              aria-label="Visual replay execution"
            >
              <Play size={11} /> Replay
            </button>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Timer size={12} /> {dur}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="hide-on-mobile">
            <Clock size={12} /> {time}
          </span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
          {exec.error && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <XCircle size={14} /> <strong>Execution Error:</strong> {exec.error}
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Executed Steps ({exec.steps?.length || 0})
          </div>
          {(exec.steps || []).map((step, i) => (
            <StepDetailRow key={step.nodeId || i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Logs Page ──────────────────────────────────────────────────────────── */
export default function LogsPage() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = useCallback(() => {
    setLoading(true);
    API.get('/api/executions')
      .then(({ data }) => { setExecutions(data || []); })
      .catch(() => { toast.error('Failed to load logs'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    return executions.filter((e) => {
      const matchStatus = filter === 'all' || e.status === filter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (e.workflow?.name || '').toLowerCase().includes(q) ||
        (e.trigger || '').toLowerCase().includes(q) ||
        (e.error || '').toLowerCase().includes(q) ||
        (e.steps || []).some((s) => (s.nodeName || '').toLowerCase().includes(q) || (s.error || '').toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [executions, filter, searchQuery]);

  return (
    <div className="page-layout">
      <AppSidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Execution Logs</h1>
            <p className="page-header-subtitle">
              Comprehensive history and per-step inspection for all workflow runs
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadLogs}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="logs-search-input"
              className="form-input"
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 30 : 10, fontSize: '0.82rem', height: 34 }}
              placeholder="Filter by workflow or error..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                }}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'success', label: 'Success', icon: CheckCircle2 },
                { id: 'failed', label: 'Failed', icon: XCircle },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id)}
                  className={`btn btn-sm ${filter === btn.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', gap: 4 }}
                >
                  {btn.icon && <btn.icon size={12} />}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>

            <span className="text-muted text-xs" style={{ whiteSpace: 'nowrap' }}>
              {filtered.length} of {executions.length}
            </span>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={36} /></div>
            <h3 style={{ fontWeight: 600 }}>No executions yet</h3>
            <p className="text-secondary text-sm">Run a workflow from the Dashboard or Builder to see logs here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-icon"><Search size={32} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem' }}>No matching execution logs</h3>
            <p className="text-secondary text-sm">No executions match your search &ldquo;{searchQuery}&rdquo;.</p>
            <button
              className="btn btn-secondary btn-sm mt-2"
              onClick={() => { setSearchQuery(''); setFilter('all'); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((exec) => (
              <ExecutionRow key={exec._id} exec={exec} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

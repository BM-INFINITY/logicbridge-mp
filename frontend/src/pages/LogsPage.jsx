import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RefreshCw,
  Play, Timer, Clock,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import API from '../api/client';
import toast from 'react-hot-toast';
import AppSidebar from '../components/AppSidebar';

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

/* ─── Execution Row ──────────────────────────────────────────────────────── */
function ExecutionRow({ exec }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dur  = exec.duration ? `${(exec.duration / 1000).toFixed(2)}s` : '—';
  const time = new Date(exec.startedAt).toLocaleString();
  const wfId = exec.workflow?._id || exec.workflow;

  return (
    <div className="step-log" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div className="step-log-header">
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown size={16} color="var(--text-muted)" />
            : <ChevronRight size={16} color="var(--text-muted)" />}
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {exec.workflow?.name || 'Workflow'}
          </span>
          <span className={`badge ${STATUS_CLASS[exec.status] || 'badge-muted'}`}>
            <StatusIcon status={exec.status} size={11} />
            {exec.status}
          </span>
          <span className="badge badge-muted">{exec.trigger}</span>
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
              aria-label="Visual replay"
            >
              <Play size={11} /> Visual Replay
            </button>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Timer size={12} /> {dur}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {time}
          </span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {exec.error && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <XCircle size={14} /> {exec.error}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            STEP LOGS ({exec.steps?.length || 0} steps)
          </div>
          {(exec.steps || []).map((step, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 6,
              fontFamily: 'monospace', fontSize: '0.78rem',
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge ${step.status === 'success' ? 'badge-success' : 'badge-danger'}`}
                  style={{ fontSize: '0.65rem' }}>
                  {step.status}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.nodeName}</span>
                <span style={{ color: 'var(--text-muted)' }}>({step.nodeType})</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{step.duration}ms</span>
              </div>
              {step.error && (
                <div style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <XCircle size={12} /> {step.error}
                </div>
              )}
              {step.output && (
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  Output: {JSON.stringify(step.output).slice(0, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Filter Button ──────────────────────────────────────────────────────── */
function FilterBtn({ label, active, icon: Icon, onClick }) {
  return (
    <button
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      {Icon && <Icon size={13} />} {label}
    </button>
  );
}

/* ─── Logs Page ──────────────────────────────────────────────────────────── */
export default function LogsPage() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');

  useEffect(() => {
    API.get('/api/executions')
      .then(({ data }) => { setExecutions(data); setLoading(false); })
      .catch(() => { toast.error('Failed to load logs'); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? executions : executions.filter((e) => e.status === filter);

  return (
    <div className="page-layout">
      <AppSidebar />
      <main className="main-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Execution Logs</h1>
            <p className="text-secondary text-sm mt-1">
              Full history of all workflow runs with per-step details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterBtn
              label="All Runs"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterBtn
              label="Success"
              active={filter === 'success'}
              icon={CheckCircle2}
              onClick={() => setFilter('success')}
            />
            <FilterBtn
              label="Failed"
              active={filter === 'failed'}
              icon={XCircle}
              onClick={() => setFilter('failed')}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <span className="text-muted">Loading logs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={36} /></div>
            <h3 style={{ fontWeight: 600 }}>No executions yet</h3>
            <p className="text-secondary text-sm">Run a workflow from the Dashboard to see logs here.</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {filtered.length} execution{filtered.length !== 1 ? 's' : ''}
            </div>
            {filtered.map((exec) => <ExecutionRow key={exec._id} exec={exec} />)}
          </div>
        )}
      </main>
    </div>
  );
}

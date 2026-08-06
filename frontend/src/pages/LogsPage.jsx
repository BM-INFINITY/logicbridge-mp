import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Zap, LayoutDashboard, GitBranch, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';
import API from '../api/client';
import toast from 'react-hot-toast';

function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <GitBranch size={18} />, label: 'Workflows', path: '/dashboard' },
    { icon: <Activity size={18} />, label: 'Execution Logs', path: '/logs' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="flex items-center gap-2">
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div className="font-display font-bold" style={{ fontSize: '1rem' }}>LogicBridge</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Workflow Engine</div>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.label} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>{item.icon} {item.label}</Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} className="nav-item w-full" style={{ color: 'var(--accent-danger)', display: 'flex', gap: 10 }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

const statusClass = { success: 'badge-success', failed: 'badge-danger', running: 'badge-info' };
const statusEmoji = { success: '✅', failed: '❌', running: '🔄' };

function ExecutionRow({ exec }) {
  const [open, setOpen] = useState(false);
  const dur = exec.duration ? `${(exec.duration / 1000).toFixed(2)}s` : '—';
  const time = new Date(exec.startedAt).toLocaleString();
  return (
    <div className="step-log" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div className="step-log-header">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{exec.workflow?.name || 'Workflow'}</span>
          <span className={`badge ${statusClass[exec.status] || 'badge-muted'}`}>{statusEmoji[exec.status]} {exec.status}</span>
          <span className="badge badge-muted">{exec.trigger}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>⏱ {dur}</span>
          <span>🕐 {time}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {exec.error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: 10 }}>
              ❌ {exec.error}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>STEP LOGS ({exec.steps?.length || 0} steps)</div>
          {(exec.steps || []).map((step, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontFamily: 'monospace', fontSize: '0.78rem' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge ${step.status === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>{step.status}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.nodeName}</span>
                <span style={{ color: 'var(--text-muted)' }}>({step.nodeType})</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{step.duration}ms</span>
              </div>
              {step.error && <div style={{ color: 'var(--accent-danger)' }}>Error: {step.error}</div>}
              {step.output && <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Output: {JSON.stringify(step.output).slice(0, 120)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    API.get('/api/executions')
      .then(({ data }) => { setExecutions(data); setLoading(false); })
      .catch(() => { toast.error('Failed to load logs'); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? executions : executions.filter((e) => e.status === filter);

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Execution Logs</h1>
            <p className="text-secondary text-sm mt-1">Full history of all workflow runs with per-step details</p>
          </div>
          <div className="flex items-center gap-2">
            {['all','success','failed'].map((f) => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
                {f === 'all' ? 'All Runs' : f === 'success' ? '✅ Success' : '❌ Failed'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /><span className="text-muted">Loading logs...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={36} /></div>
            <h3 style={{ fontWeight: 600 }}>No executions yet</h3>
            <p className="text-secondary text-sm">Run a workflow from the Dashboard to see logs here.</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{filtered.length} execution{filtered.length !== 1 ? 's' : ''}</div>
            {filtered.map((exec) => <ExecutionRow key={exec._id} exec={exec} />)}
          </div>
        )}
      </main>
    </div>
  );
}

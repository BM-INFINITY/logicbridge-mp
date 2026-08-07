import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, LayoutDashboard, GitBranch, Activity, LogOut, Plus, ChevronRight, Link2 } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useWorkflowStore from '../store/workflowStore';
import toast from 'react-hot-toast';
import API from '../api/client';

function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <GitBranch size={18} />, label: 'Workflows', path: '/dashboard' },
    { icon: <Activity size={18} />, label: 'Execution Logs', path: '/logs' },
    { icon: <Link2 size={18} />, label: 'Connections', path: '/connections' },
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
          <Link key={item.label} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
            {item.icon} {item.label}
          </Link>
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

function CreateWorkflowModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Workflow name is required');
    setLoading(true);
    try { await onCreate({ name, description: desc }); onClose(); }
    catch { toast.error('Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 20 }}>New Workflow</h2>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Workflow Name *</label>
          <input id="new-wf-name" className="form-input" placeholder="e.g. Daily Report Automation" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">Description</label>
          <textarea className="form-input form-textarea" placeholder="What does this workflow do?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button id="new-wf-create" className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? <><span className="spinner" /> Creating...</> : 'Create & Open Builder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { workflows, fetchWorkflows, createWorkflow, deleteWorkflow, runWorkflow } = useWorkflowStore();
  const [showModal, setShowModal] = useState(false);
  const [execStats, setExecStats] = useState({ total: 0, success: 0, failed: 0 });

  useEffect(() => {
    fetchWorkflows();
    API.get('/api/executions').then(({ data }) => {
      const total = data.length;
      const success = data.filter((e) => e.status === 'success').length;
      const failed = data.filter((e) => e.status === 'failed').length;
      setExecStats({ total, success, failed });
    }).catch(() => {});
  }, []);

  const handleCreate = async (payload) => {
    const wf = await createWorkflow(payload);
    navigate(`/builder/${wf._id}`);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this workflow?')) return;
    await deleteWorkflow(id);
    toast.success('Workflow deleted');
  };

  const handleRun = async (id, e) => {
    e.stopPropagation();
    try {
      toast.loading('Running workflow...', { id: 'run' });
      await runWorkflow(id);
      toast.success('Workflow completed!', { id: 'run' });
      fetchWorkflows();
    } catch {
      toast.error('Execution failed', { id: 'run' });
    }
  };

  const statusColor = { active: 'var(--accent-success)', draft: 'var(--text-muted)', inactive: 'var(--accent-warning)' };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Dashboard</h1>
            <p className="text-secondary text-sm mt-1">Manage and monitor your automation workflows</p>
          </div>
          <button id="create-workflow-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="stats-grid mb-6">
          {[
            { label: 'Total Workflows', value: workflows.length, color: '#6c63ff', emoji: '⚡' },
            { label: 'Total Executions', value: execStats.total, color: '#22d3ee', emoji: '▶️' },
            { label: 'Successful Runs', value: execStats.success, color: '#22c55e', emoji: '✅' },
            { label: 'Failed Runs', value: execStats.failed, color: '#ef4444', emoji: '❌' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-value gradient-text">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
                <span style={{ fontSize: '1.5rem' }}>{s.emoji}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Workflows grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your Workflows</h2>
          <span className="text-muted text-sm">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</span>
        </div>

        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><GitBranch size={36} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>No workflows yet</h3>
            <p className="text-secondary text-sm" style={{ maxWidth: 300 }}>Create your first workflow to start automating your tasks</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create Workflow</button>
          </div>
        ) : (
          <div className="workflow-grid">
            {workflows.map((wf) => (
              <div key={wf._id} className="workflow-card" onClick={() => navigate(`/builder/${wf._id}`)}>
                <div className="flex items-center justify-between mb-3">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: wf.aiGenerated ? 'rgba(34,211,238,0.15)' : 'rgba(108,99,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: wf.aiGenerated ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                  }}>
                    {wf.aiGenerated ? '🤖' : <GitBranch size={18} />}
                  </div>
                  <span className={`badge badge-${wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'muted' : 'warning'}`}>
                    {wf.status}
                  </span>
                </div>
                <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{wf.name}</h3>
                {wf.description && <p className="text-secondary text-sm" style={{ marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{wf.description}</p>}
                <div className="flex items-center justify-between" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="text-xs text-muted">
                    {wf.nodes?.length || 0} nodes · {wf.runCount || 0} runs
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--accent-success)' }}
                      onClick={(e) => handleRun(wf._id, e)}>▶ Run</button>
                    <button className="btn btn-sm btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={(e) => handleDelete(wf._id, e)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && <CreateWorkflowModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}

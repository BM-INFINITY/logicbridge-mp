import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, GitBranch, Play, CheckCircle2, XCircle, Plus, Bot,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useWorkflowStore from '../store/workflowStore';
import toast from 'react-hot-toast';
import API from '../api/client';
import AppSidebar from '../components/AppSidebar';

/* ─── Create Workflow Modal ───────────────────────────────────────────────── */
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
        <h2 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 20 }}>
          New Workflow
        </h2>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Workflow Name *</label>
          <input
            id="new-wf-name"
            className="form-input"
            placeholder="e.g. Daily Report Automation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-input form-textarea"
            placeholder="What does this workflow do?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
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

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, IconComponent, iconColor }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-value gradient-text">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor, flexShrink: 0,
        }}>
          <IconComponent size={18} />
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Page ──────────────────────────────────────────────────────── */
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

  const stats = [
    { label: 'Total Workflows',  value: workflows.length,   IconComponent: Zap,          iconColor: '#6c63ff' },
    { label: 'Total Executions', value: execStats.total,    IconComponent: Play,         iconColor: '#22d3ee' },
    { label: 'Successful Runs',  value: execStats.success,  IconComponent: CheckCircle2, iconColor: '#22c55e' },
    { label: 'Failed Runs',      value: execStats.failed,   IconComponent: XCircle,      iconColor: '#ef4444' },
  ];

  return (
    <div className="page-layout">
      <AppSidebar />
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
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Workflows grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your Workflows</h2>
          <span className="text-muted text-sm">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><GitBranch size={36} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>No workflows yet</h3>
            <p className="text-secondary text-sm" style={{ maxWidth: 300 }}>
              Create your first workflow to start automating your tasks
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create Workflow
            </button>
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
                    {wf.aiGenerated ? <Bot size={18} /> : <GitBranch size={18} />}
                  </div>
                  <span className={`badge badge-${wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'muted' : 'warning'}`}>
                    {wf.status}
                  </span>
                </div>
                <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{wf.name}</h3>
                {wf.description && (
                  <p className="text-secondary text-sm" style={{
                    marginBottom: 12, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {wf.description}
                  </p>
                )}
                <div className="flex items-center justify-between" style={{
                  marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)',
                }}>
                  <div className="text-xs text-muted">
                    {wf.nodes?.length || 0} nodes · {wf.runCount || 0} runs
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--accent-success)', gap: 4 }}
                      onClick={(e) => handleRun(wf._id, e)}
                      aria-label={`Run ${wf.name}`}
                    >
                      <Play size={12} /> Run
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={(e) => handleDelete(wf._id, e)}
                      aria-label={`Delete ${wf.name}`}
                    >
                      Delete
                    </button>
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

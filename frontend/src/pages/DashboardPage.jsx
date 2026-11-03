import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, GitBranch, Play, CheckCircle2, XCircle, Plus, Bot, LayoutTemplate,
  Search, X, ArrowUpDown,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useWorkflowStore from '../store/workflowStore';
import toast from 'react-hot-toast';
import API from '../api/client';
import AppSidebar from '../components/AppSidebar';
import TemplatesModal from '../components/TemplatesModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { instantiateTemplate } from '../utils';

/* ─── Create Workflow Modal ───────────────────────────────────────────────── */
function CreateWorkflowModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Workflow name is required');
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: desc.trim() });
      onClose();
    } catch {
      toast.error('Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Plus size={20} color="var(--accent-primary)" /> New Workflow
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" htmlFor="new-wf-name">Workflow Name *</label>
          <input
            id="new-wf-name"
            className="form-input"
            placeholder="e.g. Daily Report Automation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" htmlFor="new-wf-desc">Description</label>
          <textarea
            id="new-wf-desc"
            className="form-input form-textarea"
            placeholder="What does this workflow do?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            id="new-wf-create"
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={loading}
          >
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [execStats, setExecStats] = useState({ total: 0, success: 0, failed: 0 });
  const [workflowToDelete, setWorkflowToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'draft'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name' | 'runs'

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      fetchWorkflows(),
      API.get('/api/executions').then(({ data }) => {
        if (!isMounted) return;
        const total = data.length;
        const success = data.filter((e) => e.status === 'success').length;
        const failed = data.filter((e) => e.status === 'failed').length;
        setExecStats({ total, success, failed });
      }).catch(() => {}),
    ]).finally(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [fetchWorkflows]);

  const handleCreate = async (payload) => {
    const wf = await createWorkflow(payload);
    navigate(`/builder/${wf._id}`);
  };

  const handleUseTemplate = async (template, installConfig = {}) => {
    try {
      const instantiated = instantiateTemplate(template, installConfig);
      const wf = await createWorkflow({
        name: instantiated.name,
        description: instantiated.description,
        nodes: instantiated.nodes,
        edges: instantiated.edges,
        variables: instantiated.variables || {},
        status: 'draft',
      });
      toast.success(`Template "${instantiated.name}" created!`);
      navigate(`/builder/${wf._id}`);
    } catch {
      toast.error('Failed to create workflow from template');
    }
  };

  const handleConfirmDelete = async () => {
    if (!workflowToDelete) return;
    setIsDeleting(true);
    try {
      await deleteWorkflow(workflowToDelete._id);
      toast.success(`Workflow "${workflowToDelete.name}" deleted`);
      setWorkflowToDelete(null);
    } catch {
      toast.error('Failed to delete workflow');
    } finally {
      setIsDeleting(false);
    }
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

  const filteredWorkflows = useMemo(() => {
    let list = [...workflows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((w) =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((w) => w.status === statusFilter);
    }

    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'runs') {
      list.sort((a, b) => (b.runCount || 0) - (a.runCount || 0));
    } else {
      // Recent (by updatedAt or createdAt)
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }

    return list;
  }, [workflows, searchQuery, statusFilter, sortBy]);

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
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Dashboard</h1>
            <p className="page-header-subtitle">Manage and monitor your automation workflows</p>
          </div>
          <div className="flex gap-2">
            <button id="dashboard-templates-btn" className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(true)}>
              <LayoutTemplate size={15} /> Browse Templates
            </button>
            <button id="create-workflow-btn" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <Plus size={16} /> New Workflow
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid mb-6">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Workflows Toolbar: Search, Filter, Sort */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="workflow-search-input"
                className="form-input"
                style={{ paddingLeft: 34, paddingRight: searchQuery ? 32 : 12, fontSize: '0.85rem', height: 36 }}
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              {['all', 'active', 'draft'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    textTransform: 'capitalize',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Sort dropdown & count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <ArrowUpDown size={14} />
              <select
                className="form-input"
                style={{ height: 34, padding: '4px 8px', fontSize: '0.8rem', width: 140 }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort workflows"
              >
                <option value="recent">Recently Updated</option>
                <option value="name">Alphabetical</option>
                <option value="runs">Most Executed</option>
              </select>
            </div>
            <span className="text-muted text-xs" style={{ whiteSpace: 'nowrap' }}>
              {filteredWorkflows.length} of {workflows.length}
            </span>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="workflow-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card skeleton-card skeleton" style={{ height: 170 }} />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          /* Empty state when user has no workflows at all */
          <div className="empty-state">
            <div className="empty-icon"><GitBranch size={36} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>No workflows yet</h3>
            <p className="text-secondary text-sm" style={{ maxWidth: 300 }}>
              Create your first workflow or pick a ready-to-use template to get started
            </p>
            <div className="flex gap-3 mt-2">
              <button className="btn btn-secondary" onClick={() => setShowTemplates(true)}>
                <LayoutTemplate size={16} /> Browse Templates
              </button>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Create Workflow
              </button>
            </div>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          /* Empty search / filter results */
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-icon"><Search size={32} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem' }}>No matching workflows</h3>
            <p className="text-secondary text-sm" style={{ maxWidth: 320 }}>
              No workflows match &ldquo;{searchQuery}&rdquo; with the selected filter.
            </p>
            <button
              className="btn btn-secondary btn-sm mt-2"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Workflows grid */
          <div className="workflow-grid">
            {filteredWorkflows.map((wf) => (
              <div key={wf._id} className="workflow-card" onClick={() => navigate(`/builder/${wf._id}`)}>
                <div className="flex items-center justify-between mb-3">
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: wf.aiGenerated ? 'rgba(34,211,238,0.15)' : 'rgba(108,99,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: wf.aiGenerated ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                    flexShrink: 0,
                  }}>
                    {wf.aiGenerated ? <Bot size={18} /> : <GitBranch size={18} />}
                  </div>
                  <span className={`badge badge-${wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'muted' : 'warning'}`}>
                    {wf.status}
                  </span>
                </div>
                <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{wf.name}</h3>
                {wf.description ? (
                  <p className="text-secondary text-sm" style={{
                    marginBottom: 12, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38,
                  }}>
                    {wf.description}
                  </p>
                ) : (
                  <div style={{ minHeight: 38, marginBottom: 12 }} />
                )}
                <div className="flex items-center justify-between" style={{
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkflowToDelete(wf);
                      }}
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
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onLoad={handleUseTemplate} />}

      {/* Accessible Confirm Dialog for Deletion */}
      <ConfirmDialog
        isOpen={Boolean(workflowToDelete)}
        title="Delete Workflow"
        message={`Are you sure you want to permanently delete "${workflowToDelete?.name}"? All configuration, history, and schedules associated with this workflow will be removed.`}
        confirmLabel="Delete Workflow"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setWorkflowToDelete(null)}
      />
    </div>
  );
}

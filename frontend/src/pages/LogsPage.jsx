import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RefreshCw,
  Play, Timer, Clock, Search, X, Copy, Check,
  Filter, Calendar, ArrowUpDown, Sliders, Layers,
  ExternalLink, UserCheck, AlertTriangle, AlertCircle
} from 'lucide-react';
import API from '../api/client';
import toast from 'react-hot-toast';
import AppSidebar from '../components/AppSidebar';
import { ExecutionDetailModal, AgentToolCallViewer } from '../components/execution';
import { Badge, StatusIndicator, Button, EmptyState } from '../components/ui';

/* ─── Status Config ──────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  success: { label: 'Success', variant: 'success', status: 'success', icon: CheckCircle2, color: 'var(--accent-success)' },
  failed:  { label: 'Failed',  variant: 'danger',  status: 'error',   icon: XCircle,      color: 'var(--accent-danger)' },
  running: { label: 'Running', variant: 'info',    status: 'running', icon: RefreshCw,    color: 'var(--accent-secondary)' },
  waiting_approval: { label: 'Waiting Approval', variant: 'warning', status: 'warning', icon: UserCheck, color: '#ec4899' },
  paused:  { label: 'Paused',  variant: 'warning', status: 'warning', icon: Clock,        color: '#0ea5e9' },
  cancelled: { label: 'Cancelled', variant: 'neutral', status: 'neutral', icon: AlertCircle, color: 'var(--text-muted)' },
};

/* ─── Date Filter Presets ────────────────────────────────────────────────── */
const DATE_RANGES = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Past 24 Hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7days', label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30days', label: 'Last 30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
];

/* ─── Sort Presets ───────────────────────────────────────────────────────── */
const SORT_OPTIONS = [
  { id: 'latest', label: 'Latest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'duration-desc', label: 'Duration (Longest)' },
  { id: 'duration-asc', label: 'Duration (Shortest)' },
];

export default function LogsPage() {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal
  const [inspectModalExec, setInspectModalExec] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  // Copied IDs tracker
  const [copiedId, setCopiedId] = useState(null);

  // Fetch executions & workflows
  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [execRes, wfRes] = await Promise.all([
        API.get('/api/executions?limit=200'),
        API.get('/api/workflows').catch(() => ({ data: [] })),
      ]);

      setExecutions(execRes.data || []);
      setWorkflows(wfRes.data || []);
    } catch (err) {
      if (!silent) toast.error('Failed to load execution logs');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Live auto-polling when executions contain active states (running or waiting_approval)
  useEffect(() => {
    const hasActiveRuns = executions.some(
      (e) => e.status === 'running' || e.status === 'waiting_approval'
    );
    if (!hasActiveRuns) return;

    const interval = setInterval(() => {
      if (document.hidden) return; // pause if background tab
      loadLogs(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [executions, loadLogs]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, workflowFilter, dateRangeFilter, sortOrder, pageSize]);

  // Filter & Sort Logic
  const filteredAndSorted = useMemo(() => {
    const now = Date.now();
    const dateConfig = DATE_RANGES.find((r) => r.id === dateRangeFilter);
    const minTimestamp = dateConfig?.ms ? now - dateConfig.ms : null;

    let result = executions.filter((exec) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && exec.status !== statusFilter) return false;

      // 2. Workflow Filter
      const wfId = exec.workflow?._id || exec.workflow;
      if (workflowFilter !== 'all' && wfId !== workflowFilter) return false;

      // 3. Date Range Filter
      if (minTimestamp && new Date(exec.startedAt).getTime() < minTimestamp) return false;

      // 4. Search Query (workflow name, exec id, trigger, errors, step names)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const wfName = (exec.workflow?.name || '').toLowerCase();
        const idStr = String(exec._id || '').toLowerCase();
        const trigger = (exec.trigger || '').toLowerCase();
        const err = (exec.error || '').toLowerCase();
        const hasMatchingStep = (exec.steps || []).some(
          (s) => (s.nodeName || '').toLowerCase().includes(q) || (s.error || '').toLowerCase().includes(q)
        );

        if (!wfName.includes(q) && !idStr.includes(q) && !trigger.includes(q) && !err.includes(q) && !hasMatchingStep) {
          return false;
        }
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortOrder === 'latest') return new Date(b.startedAt) - new Date(a.startedAt);
      if (sortOrder === 'oldest') return new Date(a.startedAt) - new Date(b.startedAt);
      if (sortOrder === 'duration-desc') return (b.duration || 0) - (a.duration || 0);
      if (sortOrder === 'duration-asc') return (a.duration || 0) - (b.duration || 0);
      return 0;
    });

    return result;
  }, [executions, searchQuery, statusFilter, workflowFilter, dateRangeFilter, sortOrder]);

  // Pagination Slice
  const totalItems = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  // High-level statistics
  const stats = useMemo(() => {
    const total = executions.length;
    if (total === 0) return { total: 0, successRate: '0%', avgDur: '0s', runningCount: 0 };

    const successCount = executions.filter((e) => e.status === 'success').length;
    const rate = Math.round((successCount / total) * 100);
    const runsWithDur = executions.filter((e) => typeof e.duration === 'number' && e.duration > 0);
    const avgMs = runsWithDur.length > 0
      ? runsWithDur.reduce((acc, curr) => acc + curr.duration, 0) / runsWithDur.length
      : 0;
    const avgSec = (avgMs / 1000).toFixed(2);
    const runningCount = executions.filter((e) => e.status === 'running' || e.status === 'waiting_approval').length;

    return {
      total,
      successRate: `${rate}%`,
      avgDur: `${avgSec}s`,
      runningCount,
    };
  }, [executions]);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyExecutionId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Execution ID copied');
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="page-layout">
      <AppSidebar />
      <main className="main-content">
        {/* Header Strip */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-header-title">Execution Monitoring & Logs</h1>
              {stats.runningCount > 0 && (
                <span
                  style={{
                    background: 'rgba(108,99,255,0.15)',
                    border: '1px solid rgba(108,99,255,0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                  {stats.runningCount} Active
                </span>
              )}
            </div>
            <p className="page-header-subtitle">
              Comprehensive real-time tracking, payload inspection, diagnostics, and debugging traces
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadLogs(false)}
              disabled={loading}
              icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Key Metrics Overview Strip ──────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Executions
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Success Rate
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-success)', marginTop: 2 }}>
              {stats.successRate}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Average Duration
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: 2 }}>
              {stats.avgDur}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Active / In Flight
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: stats.runningCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: 2 }}>
              {stats.runningCount}
            </div>
          </div>
        </div>

        {/* ── Search, Filters & Controls Bar ───────────────────────────────── */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="logs-search-input"
                className="form-input"
                style={{ paddingLeft: 32, paddingRight: searchQuery ? 30 : 10, fontSize: '0.82rem', height: 36 }}
                placeholder="Search workflow name, execution ID, trigger, or step..."
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

            {/* Workflow Filter Dropdown */}
            <select
              id="logs-workflow-filter"
              className="form-select"
              style={{ width: 'auto', minWidth: 160, fontSize: '0.8rem', height: 36 }}
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
            >
              <option value="all">All Workflows</option>
              {workflows.map((wf) => (
                <option key={wf._id} value={wf._id}>
                  {wf.name}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              id="logs-date-filter"
              className="form-select"
              style={{ width: 'auto', minWidth: 140, fontSize: '0.8rem', height: 36 }}
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
            >
              {DATE_RANGES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              id="logs-sort-order"
              className="form-select"
              style={{ width: 'auto', minWidth: 140, fontSize: '0.8rem', height: 36 }}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Status Segmented Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'success', label: 'Success', icon: CheckCircle2 },
                { id: 'failed', label: 'Failed', icon: XCircle },
                { id: 'running', label: 'Running', icon: RefreshCw },
                { id: 'waiting_approval', label: 'Waiting Approval', icon: UserCheck },
                { id: 'paused', label: 'Paused', icon: Clock },
              ].map((btn) => {
                const isSelected = statusFilter === btn.id;
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    onClick={() => setStatusFilter(btn.id)}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '4px 10px', fontSize: '0.74rem', gap: 4 }}
                  >
                    {Icon && <Icon size={12} className={btn.id === 'running' && isSelected ? 'animate-spin' : ''} />}
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>
                Showing {totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
              </span>
              <select
                className="form-select"
                style={{ height: 28, fontSize: '0.72rem', padding: '0 20px 0 6px', width: 'auto' }}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Executions Table / Card List ─────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <EmptyState
            icon={<Activity size={32} />}
            title="No executions recorded"
            description="Run a workflow from the Dashboard or Builder to inspect real-time execution logs and diagnostics."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/workflows')}>
                Go to Workflows
              </Button>
            }
          />
        ) : filteredAndSorted.length === 0 ? (
          <EmptyState
            icon={<Search size={32} />}
            title="No matching executions"
            description="No executions matched your search and filter criteria."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setWorkflowFilter('all');
                  setDateRangeFilter('all');
                  setSortOrder('latest');
                }}
              >
                Reset All Filters
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paginatedExecutions.map((exec) => {
              const isOpen = Boolean(expandedRows[exec._id]);
              const cfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.running;
              const isRunning = exec.status === 'running';

              const wfId = exec.workflow?._id || exec.workflow;
              const wfName = exec.workflow?.name || 'Untitled Workflow';
              const dur = typeof exec.duration === 'number'
                ? exec.duration < 1000 ? `${exec.duration}ms` : `${(exec.duration / 1000).toFixed(2)}s`
                : isRunning ? 'running...' : '—';
              const formattedDate = new Date(exec.startedAt).toLocaleString();
              const steps = exec.steps || [];
              const passedCount = steps.filter((s) => s.status === 'success').length;
              const skippedCount = steps.filter((s) => s.status === 'skipped').length;
              const failedCount = steps.filter((s) => s.status === 'failed').length;

              return (
                <div
                  key={exec._id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Row Summary Strip */}
                  <div
                    onClick={() => toggleRow(exec._id)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: Expand Caret + Status Badge + Workflow Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 280px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>

                      <StatusIndicator
                        status={cfg.status}
                        label={cfg.label}
                        size="sm"
                      />

                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {wfName}
                      </span>

                      {/* Execution ID with quick copy */}
                      <button
                        type="button"
                        onClick={(e) => copyExecutionId(e, exec._id)}
                        title="Copy Execution ID"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{String(exec._id).slice(-6)}</span>
                        {copiedId === exec._id ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                      </button>

                      {/* Trigger Badge */}
                      {exec.trigger && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-elevated)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          {exec.trigger}
                        </span>
                      )}
                    </div>

                    {/* Middle: Steps summary + Duration + Date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Layers size={13} />
                        {steps.length} step{steps.length !== 1 ? 's' : ''}
                        {failedCount > 0 && <span style={{ color: '#ef4444' }}>({failedCount} failed)</span>}
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Timer size={13} />
                        {dur}
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="hide-on-mobile">
                        <Clock size={13} />
                        {formattedDate}
                      </span>
                    </div>

                    {/* Right: Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setInspectModalExec(exec)}
                        style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Sliders size={11} /> Inspect
                      </button>

                      {wfId && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/builder/${wfId}`, { state: { replayExecution: exec } })}
                          style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="Visual Canvas Replay"
                        >
                          <Play size={11} /> Replay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Step Summary Section */}
                  {isOpen && (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'var(--bg-elevated)',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {exec.error && (
                        <div
                          style={{
                            padding: '8px 12px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 6,
                            color: 'var(--accent-danger)',
                            fontSize: '0.78rem',
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <XCircle size={14} />
                          <span><strong>Failure Context:</strong> {exec.error}</span>
                        </div>
                      )}

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Executed Steps Sequence ({steps.length})</span>
                        <span
                          style={{ color: 'var(--accent-primary)', cursor: 'pointer', textTransform: 'none', fontWeight: 600 }}
                          onClick={() => setInspectModalExec(exec)}
                        >
                          Open Detailed Timeline & Diagnostics →
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {steps.map((st, i) => {
                          const isOk = st.status === 'success';
                          const isFail = st.status === 'failed';
                          const isSkip = st.status === 'skipped';
                          return (
                            <div
                              key={st.nodeId || i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                background: 'var(--bg-card)',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                fontSize: '0.75rem',
                              }}
                            >
                              {isOk && <CheckCircle2 size={13} color="#22c55e" />}
                              {isFail && <XCircle size={13} color="#ef4444" />}
                              {isSkip && <AlertCircle size={13} color="#f59e0b" />}

                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{st.nodeName}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({st.nodeType})</span>
                              {st.error && <span style={{ color: '#ef4444', fontSize: '0.7rem', marginLeft: 4 }}>— {st.error}</span>}
                              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{st.duration || 0}ms</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Pagination Controls ────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Page {currentPage} of {totalPages}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Fullscreen Execution Detail Modal ────────────────────────────── */}
        {inspectModalExec && (
          <ExecutionDetailModal
            execution={inspectModalExec}
            isOpen={Boolean(inspectModalExec)}
            onClose={() => setInspectModalExec(null)}
            onExecutionUpdate={(updated) => {
              setExecutions((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
              setInspectModalExec(updated);
            }}
          />
        )}
      </main>
    </div>
  );
}
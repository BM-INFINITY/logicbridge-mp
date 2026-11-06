import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, CheckCircle2, XCircle, AlertCircle, Clock, UserCheck, Play,
  RefreshCw, Copy, Check, Activity, Braces, Sparkles, AlertTriangle,
  ExternalLink, Layers, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api/client';
import { Modal, Button, Badge, StatusIndicator, Tabs, Alert, ConfirmDialog } from '../ui';
import NodeInspector from './NodeInspector';
import ErrorDebugger from './ErrorDebugger';
import AgentToolCallViewer from './AgentToolCallViewer';
import useLiveExecution from '../../hooks/useLiveExecution';

export default function ExecutionDetailModal({
  execution: initialExec,
  isOpen,
  onClose,
  onExecutionUpdate,
}) {
  const navigate = useNavigate();
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('steps'); // 'steps' | 'inspector' | 'agent' | 'approval' | 'error'
  const [copiedId, setCopiedId] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Hook for live polling while running
  const {
    execution,
    isLive,
    refreshNow,
  } = useLiveExecution(initialExec?._id, initialExec, {
    enabled: isOpen && initialExec?.status === 'running',
    onStatusChange: (newStatus) => {
      toast.success(`Execution status updated: ${newStatus}`);
    },
  });

  const steps = execution?.steps || [];
  const selectedStep = steps[selectedStepIndex] || steps[0] || null;

  const isOk = execution?.status === 'success';
  const isFailed = execution?.status === 'failed';
  const isWaitingApproval = execution?.status === 'waiting_approval';
  const isPaused = execution?.status === 'paused';
  const isRunning = execution?.status === 'running';

  const hasAgentStep = steps.some((s) => s.nodeType === 'action-ai-agent' || s.output?.toolCalls);

  const durationStr = useMemo(() => {
    if (!execution?.duration) return '—';
    const s = execution.duration / 1000;
    if (s < 1) return `${execution.duration}ms`;
    if (s < 60) return `${s.toFixed(2)}s`;
    const m = Math.floor(s / 60);
    const rem = (s % 60).toFixed(0);
    return `${m}m ${rem}s`;
  }, [execution?.duration]);

  const handleCopyId = () => {
    if (!execution?._id) return;
    navigator.clipboard.writeText(execution._id);
    setCopiedId(true);
    toast.success('Execution ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleReplayInBuilder = () => {
    const wfId = execution.workflow?._id || execution.workflow;
    if (wfId) {
      onClose();
      navigate(`/builder/${wfId}`, { state: { replayExecution: execution } });
    } else {
      toast.error('Workflow reference not found');
    }
  };

  const handleConfirmRetry = async () => {
    setRetrying(true);
    try {
      const res = await API.post(`/api/executions/${execution._id}/replay`);
      const newExec = res.data?.data || res.data;
      toast.success('Workflow re-triggered successfully!');
      setShowRetryConfirm(false);
      onClose();
      if (onExecutionUpdate) onExecutionUpdate(newExec);
      // Navigate to builder to monitor
      const wfId = execution.workflow?._id || execution.workflow;
      if (wfId) {
        navigate(`/builder/${wfId}`);
      }
    } catch (err) {
      toast.error(`Retry failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (!isOpen || !execution) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isOk && <CheckCircle2 size={20} color="#22c55e" />}
            {isFailed && <XCircle size={20} color="#ef4444" />}
            {isRunning && <RefreshCw size={20} color="#22d3ee" className="animate-spin" />}
            {isWaitingApproval && <UserCheck size={20} color="#ec4899" className="animate-pulse" />}
            {isPaused && <Clock size={20} color="#0ea5e9" />}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {execution.workflow?.name || 'Workflow Execution'}
                </span>
                <Badge
                  variant={isOk ? 'success' : isFailed ? 'danger' : isRunning ? 'info' : 'warning'}
                  size="sm"
                >
                  {execution.status}
                </Badge>
                {isLive && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.68rem',
                      color: '#22d3ee',
                      background: 'rgba(34,211,238,0.1)',
                      padding: '2px 6px',
                      borderRadius: 10,
                    }}
                  >
                    <span className="spinner" style={{ width: 8, height: 8 }} /> Live
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <button
                  onClick={handleCopyId}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: 0,
                  }}
                  title="Click to copy ID"
                >
                  ID: {execution._id.slice(0, 8)}...
                  {copiedId ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                </button>
                <span>Trigger: <strong style={{ color: 'var(--text-secondary)' }}>{execution.trigger || 'manual'}</strong></span>
                <span>Duration: <strong style={{ color: 'var(--text-secondary)' }}>{durationStr}</strong></span>
                <span>Started: {new Date(execution.startedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReplayInBuilder}
              icon={<Play size={12} />}
            >
              Replay in Canvas
            </Button>

            <Button
              variant={isFailed ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowRetryConfirm(true)}
              icon={<RefreshCw size={12} />}
            >
              Retry
            </Button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            padding: '0 16px',
            gap: 4,
          }}
        >
          <button
            onClick={() => setActiveTab('steps')}
            style={{
              padding: '10px 14px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'steps' ? 600 : 400,
              color: activeTab === 'steps' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'steps' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Activity size={13} />
            <span>Step Timeline ({steps.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            style={{
              padding: '10px 14px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'inspector' ? 600 : 400,
              color: activeTab === 'inspector' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'inspector' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Braces size={13} />
            <span>Node Inspector</span>
          </button>

          {hasAgentStep && (
            <button
              onClick={() => setActiveTab('agent')}
              style={{
                padding: '10px 14px',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'agent' ? 600 : 400,
                color: activeTab === 'agent' ? '#8b5cf6' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'agent' ? '2px solid #8b5cf6' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={13} color="#8b5cf6" />
              <span>AI Agent Trace</span>
            </button>
          )}

          {execution.error && (
            <button
              onClick={() => setActiveTab('error')}
              style={{
                padding: '10px 14px',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'error' ? 600 : 400,
                color: activeTab === 'error' ? 'var(--accent-danger)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'error' ? '2px solid var(--accent-danger)' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 'auto',
              }}
            >
              <XCircle size={13} color="var(--accent-danger)" />
              <span>Execution Error</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 380 }}>
          {/* TAB 1: Step Timeline & List */}
          {activeTab === 'steps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Visual Sequence Timeline Chips */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Execution Step Sequence
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflowX: 'auto',
                    paddingBottom: 4,
                  }}
                >
                  {steps.map((st, idx) => {
                    const isSelected = idx === selectedStepIndex;
                    const isOkStep = st.status === 'success';
                    const isFailStep = st.status === 'failed';

                    return (
                      <React.Fragment key={st.nodeId || idx}>
                        <div
                          onClick={() => {
                            setSelectedStepIndex(idx);
                            setActiveTab('inspector');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
                            background: isSelected ? 'rgba(108, 99, 255, 0.15)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isOkStep && <CheckCircle2 size={12} color="#22c55e" />}
                          {isFailStep && <XCircle size={12} color="#ef4444" />}
                          {!isOkStep && !isFailStep && <Clock size={12} color="#f59e0b" />}

                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {st.nodeName}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {st.duration || 0}ms
                          </span>
                        </div>

                        {idx < steps.length - 1 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Step Rows List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((st, idx) => {
                  const isFailStep = st.status === 'failed';
                  const isOkStep = st.status === 'success';

                  return (
                    <div
                      key={st.nodeId || idx}
                      onClick={() => {
                        setSelectedStepIndex(idx);
                        setActiveTab('inspector');
                      }}
                      style={{
                        background: 'var(--bg-card)',
                        border: isFailStep ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', width: 20 }}>
                          #{idx + 1}
                        </span>

                        {isOkStep && <CheckCircle2 size={15} color="#22c55e" />}
                        {isFailStep && <XCircle size={15} color="#ef4444" />}
                        {!isOkStep && !isFailStep && <Clock size={15} color="#f59e0b" />}

                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {st.nodeName}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            <code>{st.nodeType}</code>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {st.error && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-danger)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {st.error}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {st.duration || 0}ms
                        </span>
                        <Button variant="ghost" size="sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          Inspect <ArrowUpRight size={11} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Node Inspector */}
          {activeTab === 'inspector' && selectedStep && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Selecting step:</span>
                <select
                  value={selectedStepIndex}
                  onChange={(e) => setSelectedStepIndex(Number(e.target.value))}
                  style={{
                    fontSize: '0.75rem',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '2px 8px',
                  }}
                >
                  {steps.map((s, i) => (
                    <option key={s.nodeId || i} value={i}>
                      #{i + 1} — {s.nodeName} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <NodeInspector
                step={selectedStep}
                onRetry={() => setShowRetryConfirm(true)}
              />
            </div>
          )}

          {/* TAB 3: AI Agent Trace */}
          {activeTab === 'agent' && (
            <div>
              {steps
                .filter((s) => s.nodeType === 'action-ai-agent' || s.output?.toolCalls)
                .map((st, i) => (
                  <div key={st.nodeId || i} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} color="#8b5cf6" />
                      <span>{st.nodeName} Trace</span>
                    </div>
                    <AgentToolCallViewer output={st.output} />
                  </div>
                ))}
            </div>
          )}

          {/* TAB 4: Error Diagnostic */}
          {activeTab === 'error' && (
            <ErrorDebugger
              step={steps.find((s) => s.status === 'failed') || null}
              executionError={execution.error}
              onRetry={() => setShowRetryConfirm(true)}
            />
          )}
        </div>

        {/* Confirmation Dialog for Retry */}
        {showRetryConfirm && (
          <ConfirmDialog
            isOpen={showRetryConfirm}
            title="Retry Workflow Execution?"
            message="Retrying an execution will run workflow steps again. External side effects (such as HTTP POST requests, emails, and database writes) may be repeated. Are you sure you want to proceed?"
            confirmText={retrying ? 'Retrying...' : 'Confirm & Run'}
            cancelText="Cancel"
            variant="warning"
            onConfirm={handleConfirmRetry}
            onCancel={() => setShowRetryConfirm(false)}
          />
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';

export default function ApprovalsModal({ isOpen, onClose, onDecisionMade }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/executions/approvals');
      setApprovals(res.data?.data || res.data || []);
    } catch (err) {
      toast.error(`Failed to load approvals: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchApprovals();
    }
  }, [isOpen]);

  const handleDecide = async (executionId, decision) => {
    setDecidingId(executionId);
    try {
      const comments = commentsMap[executionId] || '';
      const res = await API.post(`/api/executions/approvals/${executionId}/decide`, {
        decision,
        comments,
      });

      toast.success(
        decision === 'approved' ? 'Request approved successfully!' : 'Request rejected.'
      );

      // Refresh list
      await fetchApprovals();
      if (onDecisionMade) {
        onDecisionMade(res.data?.data || res.data);
      }
    } catch (err) {
      toast.error(`Decision error: ${err.response?.data?.message || err.message}`);
    } finally {
      setDecidingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 640,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Pending Approvals
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Human review tasks waiting for your decision
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchApprovals}
              disabled={loading}
              title="Refresh"
              style={{ padding: '4px 8px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && approvals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>Loading pending requests...</div>
            </div>
          ) : approvals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.01)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                All Caught Up!
              </div>
              <div style={{ fontSize: '0.8rem' }}>
                No workflows are currently awaiting your approval.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {approvals.map((exec) => {
                const appr = exec.approval || {};
                const wfName = exec.workflow?.name || 'Untitled Workflow';
                const isDeciding = decidingId === exec._id;

                return (
                  <div
                    key={exec._id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#ec4899', fontWeight: 600, textTransform: 'uppercase' }}>
                          {wfName}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: 2 }}>
                          {appr.title || 'Approval Required'}
                        </div>
                        {appr.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                            {appr.description}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: 20,
                          padding: '2px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={11} /> Pending
                      </div>
                    </div>

                    {/* Detailed Message */}
                    {appr.message && (
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap',
                          borderLeft: '2px solid #ec4899',
                        }}
                      >
                        {appr.message}
                      </div>
                    )}

                    {/* Metadata Footer: Timeout / Requester */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <div>Started: {new Date(exec.startedAt || exec.createdAt).toLocaleString()}</div>
                      {appr.timeoutAt && (
                        <div>Timeout: {new Date(appr.timeoutAt).toLocaleTimeString()} ({appr.timeoutAction === 'approve' ? 'Auto-Approve' : 'Auto-Reject'})</div>
                      )}
                      {appr.approverRole && <div>Role: {appr.approverRole}</div>}
                    </div>

                    {/* Comments & Decision Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Optional decision notes or comments..."
                        value={commentsMap[exec._id] || ''}
                        onChange={(e) => setCommentsMap({ ...commentsMap, [exec._id]: e.target.value })}
                        style={{ fontSize: '0.78rem' }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDecide(exec._id, 'rejected')}
                          disabled={isDeciding}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <XCircle size={14} /> Reject
                        </button>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDecide(exec._id, 'approved')}
                          disabled={isDeciding}
                          style={{
                            background: '#10b981',
                            borderColor: '#10b981',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isDeciding ? (
                            <span className="spinner" style={{ width: 12, height: 12 }} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

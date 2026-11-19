import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserCog,
  FileText,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';
import AppSidebar from '../components/AppSidebar';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'roles' | 'status'
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // User role management state
  const [targetUserId, setTargetUserId] = useState('');
  const [targetRole, setTargetRole] = useState('approver');
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = {};
      if (filterSeverity) params.severity = filterSeverity;
      if (filterEventType) params.eventType = filterEventType;
      if (searchTerm) params.targetResource = searchTerm;

      const res = await API.get('/api/auth/audit-logs', { params });
      const data = res.data?.data || res.data;
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (err) {
      toast.error(`Failed to load audit logs: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  }, [filterSeverity, filterEventType, searchTerm]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!targetUserId.trim()) {
      toast.error('User ID is required');
      return;
    }

    setUpdatingRole(true);
    try {
      const res = await API.patch(`/api/auth/users/${targetUserId.trim()}/role`, {
        role: targetRole,
      });
      const data = res.data?.data || res.data;
      toast.success(
        `User ${data.name || data.email || targetUserId} updated to role "${data.role}". Token version incremented.`
      );
      setTargetUserId('');
    } catch (err) {
      toast.error(`Role update failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setUpdatingRole(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            CRITICAL
          </span>
        );
      case 'error':
        return (
          <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
            WARN
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            INFO
          </span>
        );
    }
  };

  return (
    <div className="app-layout">
      <AppSidebar />

      <main className="main-content" style={{ padding: '24px 32px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="font-display font-bold" style={{ fontSize: '1.4rem', margin: 0 }}>
                Security & Administration
              </h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Centralized Security Audit Logging, RBAC Role Management, and Infrastructure Hardening Controls
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchAuditLogs}
              disabled={loadingLogs}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
            >
              <RefreshCw size={14} className={loadingLogs ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'audit' ? '2px solid #ec4899' : '2px solid transparent',
              color: activeTab === 'audit' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'audit' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
            }}
          >
            <FileText size={16} /> Security Audit Logs ({totalLogs})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'roles' ? '2px solid #ec4899' : '2px solid transparent',
              color: activeTab === 'roles' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'roles' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
            }}
          >
            <UserCog size={16} /> Role Management
          </button>
          <button
            onClick={() => setActiveTab('status')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'status' ? '2px solid #ec4899' : '2px solid transparent',
              color: activeTab === 'status' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'status' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
            }}
          >
            <ShieldAlert size={16} /> Security Hardening Status
          </button>
        </div>

        {/* Tab 1: Security Audit Logs */}
        {activeTab === 'audit' && (
          <div>
            {/* Filters */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter by target resource or user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    width: '100%',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>

                <select
                  value={filterEventType}
                  onChange={(e) => setFilterEventType(e.target.value)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="">All Event Types</option>
                  <option value="auth.login.success">Login Success</option>
                  <option value="auth.login.failure">Login Failure</option>
                  <option value="auth.account.locked">Account Locked</option>
                  <option value="auth.rate_limit.exceeded">Rate Limit Exceeded</option>
                  <option value="auth.refresh_token.rotated">Token Rotated</option>
                  <option value="auth.refresh_token.reuse_detected">Token Reuse Alert</option>
                  <option value="auth.session.revoked">Session Revoked</option>
                  <option value="auth.role.changed">Role Changed</option>
                  <option value="authorization.failed">Auth Failure</option>
                  <option value="webhook.auth.failed">Webhook Auth Failed</option>
                  <option value="webhook.replay.attempt">Webhook Replay</option>
                  <option value="credential.created">Credential Created</option>
                  <option value="credential.deleted">Credential Deleted</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Timestamp</th>
                    <th style={{ padding: '10px 14px' }}>Event Type</th>
                    <th style={{ padding: '10px 14px' }}>Severity</th>
                    <th style={{ padding: '10px 14px' }}>Actor</th>
                    <th style={{ padding: '10px 14px' }}>Target Resource</th>
                    <th style={{ padding: '10px 14px' }}>Outcome</th>
                    <th style={{ padding: '10px 14px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {loadingLogs ? 'Loading security audit logs...' : 'No security audit events recorded matching current filters.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => (
                      <tr
                        key={log._id || idx}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#ec4899' }}>
                          <code>{log.eventType}</code>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{getSeverityBadge(log.severity)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div>{log.actorEmail || log.actorId || 'system'}</div>
                          {log.actorRole && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({log.actorRole})</div>}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          <code>{log.targetResource || '—'}</code>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              color: log.outcome === 'success' ? '#10b981' : '#ef4444',
                              fontWeight: 600,
                            }}
                          >
                            {log.outcome}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(log.details || {})}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: User Role Management */}
        {activeTab === 'roles' && (
          <div style={{ maxWidth: 560 }}>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 28px',
              }}
            >
              <h3 className="font-display font-bold" style={{ fontSize: '1.1rem', marginBottom: 6 }}>
                Update User Role (Admin Only)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20 }}>
                Elevate or adjust a user's role. Updating roles automatically increments the target user's{' '}
                <code>tokenVersion</code>, invalidating their existing active sessions across all backend instances.
              </p>

              <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
                    User Mongo ObjectId:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 507f1f77bcf86cd799439011"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    required
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
                    Assigned Role:
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="user">User (Standard privilege)</option>
                    <option value="approver">Approver (Authorized for human review gates)</option>
                    <option value="admin">Admin (Full administrative & security privilege)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingRole}
                  style={{ marginTop: 8, fontSize: '0.82rem', padding: '10px 16px' }}
                >
                  {updatingRole ? 'Updating Role...' : 'Update Role & Invalidate Sessions'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Security Hardening Status */}
        {activeTab === 'status' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>SEC-15: HTTP Security Headers</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Helmet integrated: Content-Security-Policy, HSTS (HTTPS), nosniff, Referrer-Policy, frameguard (DENY), Permissions-Policy. X-Powered-By removed.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>SEC-01 & SEC-02: SSRF & AI Isolation</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Socket-level lookup pinning blocks loopback/private CIDRs. Explicit allowlist via ALLOWED_PRIVATE_AI_HOSTS. Cloud metadata unconditionally blocked.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>SEC-08: Brute-Force & Rate Limiting</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                IP and account-level throttling with 15-minute lockouts. TRUST_PROXY header spoofing defenses active.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>SEC-09: Token Lifecycle & CAS Rotation</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Atomic CAS token rotation with immediate token family invalidation upon reuse. Fail-closed (HTTP 503) on database disconnect.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>SEC-06 & SEC-11: Tenant Filesystem Sandbox</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                All six storage operations scoped to trusted context. Realpath containment and symlink TOCTOU guards prevent path traversal.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <CheckCircle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Centralized Security Audit Logging</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Structured audit trail with sensitive credential redaction, TTL retention indexes, and RBAC-scoped query APIs.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

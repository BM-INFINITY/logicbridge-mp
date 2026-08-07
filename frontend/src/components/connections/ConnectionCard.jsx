import React from 'react';
import { ShieldCheck, ShieldOff, Loader, Trash2, RefreshCw } from 'lucide-react';
import ProviderBadge from './ProviderBadge';

const STATUS_CONFIG = {
  active:       { label: 'Active',        color: 'var(--accent-success)', bg: 'rgba(34,197,94,0.1)',  icon: <ShieldCheck size={12} /> },
  expired:      { label: 'Expired',       color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.1)', icon: <ShieldOff size={12} /> },
  disconnected: { label: 'Disconnected',  color: 'var(--accent-danger)',  bg: 'rgba(239,68,68,0.1)',  icon: <ShieldOff size={12} /> },
  pending:      { label: 'Pending',       color: 'var(--text-muted)',     bg: 'rgba(255,255,255,0.05)', icon: <Loader size={12} /> },
};

/**
 * ConnectionCard — displays a single connection with verify/delete actions.
 */
export default function ConnectionCard({ connection, onVerify, onDelete, verifying }) {
  const status = STATUS_CONFIG[connection.status] || STATUS_CONFIG.pending;
  const ts = connection.lastVerifiedAt
    ? new Date(connection.lastVerifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'border-color var(--transition), box-shadow var(--transition)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Subtle glow strip at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-gradient)', opacity: connection.status === 'active' ? 1 : 0.3 }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem',
            border: '1px solid var(--border)',
          }}>
            {connection.provider === 'gmail' ? '📩' : connection.provider === 'outlook' ? '📬' : '📧'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{connection.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {connection.email || 'No email on record'}
            </div>
          </div>
        </div>
        <ProviderBadge provider={connection.provider} />
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: status.bg, color: status.color,
          borderRadius: 'var(--radius-full)',
          fontSize: '0.72rem', fontWeight: 600,
          padding: '3px 10px',
          border: `1px solid ${status.color}30`,
        }}>
          {status.icon} {status.label}
        </span>
        {ts && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Verified {ts}
          </span>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button
          id={`verify-connection-${connection._id}`}
          onClick={() => onVerify(connection._id)}
          disabled={verifying}
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            fontWeight: 500,
            padding: '7px 0',
            cursor: verifying ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background var(--transition)',
          }}
          onMouseEnter={(e) => !verifying && (e.currentTarget.style.background = 'rgba(108,99,255,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        >
          <RefreshCw size={13} style={{ animation: verifying ? 'spin 1s linear infinite' : 'none' }} />
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
        <button
          id={`delete-connection-${connection._id}`}
          onClick={() => onDelete(connection._id)}
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-danger)',
            fontSize: '0.78rem',
            fontWeight: 500,
            padding: '7px 14px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'background var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.16)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

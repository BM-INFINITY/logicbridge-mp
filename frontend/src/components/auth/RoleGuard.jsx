import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';

/**
 * Access Denied Fallback UI
 */
export function AccessDeniedView({ requiredRoles = [], currentRole = 'user' }) {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 32px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}
        >
          <ShieldAlert size={28} color="#ef4444" />
        </div>

        <h2 className="font-display font-bold" style={{ fontSize: '1.25rem', marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
          This page requires{' '}
          <strong style={{ color: '#ec4899' }}>{requiredRoles.join(' or ')}</strong> privilege. Your
          current role is <code style={{ color: 'var(--text-muted)' }}>{currentRole}</code>.
        </p>

        <Link
          to="/dashboard"
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.82rem',
            padding: '8px 18px',
          }}
        >
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Reusable Role-Based Route Guard.
 * Usability control on the client; authoritative authorization is enforced by backend RBAC.
 */
export default function RoleGuard({ allowedRoles = ['admin'], children, fallback = null }) {
  const { token, user, isLoading } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Loading state while user profile is being fetched
  if (!user && isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        Verifying authorization...
      </div>
    );
  }

  const userRole = user?.role || 'user';
  const hasAccess = userRole === 'admin' || allowedRoles.includes(userRole);

  if (!hasAccess) {
    return fallback || <AccessDeniedView requiredRoles={allowedRoles} currentRole={userRole} />;
  }

  return children;
}

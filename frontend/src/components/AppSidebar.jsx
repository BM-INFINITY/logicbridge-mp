/**
 * AppSidebar — shared application sidebar.
 *
 * Replaces the copy-pasted Sidebar function that existed in
 * DashboardPage, LogsPage, and ConnectionsPage.
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, LayoutDashboard, GitBranch, Activity, Link2, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard',      path: '/dashboard' },
  { icon: <GitBranch size={18} />,      label: 'Workflows',       path: '/dashboard' },
  { icon: <Activity size={18} />,       label: 'Execution Logs',  path: '/logs' },
  { icon: <Link2 size={18} />,          label: 'Connections',     path: '/connections' },
];

export default function AppSidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      {/* ─── Logo ─────────────────────────────────────────────── */}
      <div className="sidebar-logo">
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div className="font-display font-bold" style={{ fontSize: '1rem' }}>LogicBridge</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Workflow Engine</div>
          </div>
        </Link>
      </div>

      {/* ─── Nav ──────────────────────────────────────────────── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`nav-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <div className="sidebar-footer">
        {/* User card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 10, padding: '8px 12px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, color: '#fff',
          }}>
            {initial}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: '0.82rem', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.name || 'User'}
            </div>
            <div style={{
              fontSize: '0.7rem', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.email}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="nav-item w-full"
          style={{ color: 'var(--accent-danger)', border: 'none', background: 'none' }}
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

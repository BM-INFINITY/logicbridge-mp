/**
 * AppSidebar — shared application navigation sidebar.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, LayoutDashboard, Activity, Link2, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import useAuthStore from '../store/authStore';

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Activity size={18} />, label: 'Execution Logs', path: '/logs' },
  { icon: <Link2 size={18} />, label: 'Connections', path: '/connections' },
];

export default function AppSidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('lb_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lb_theme', theme);
  }, [theme]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <>
      {/* Mobile Top Bar on screens <= 600px */}
      <div className="mobile-header-bar" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={14} color="#fff" />
            </div>
            <span className="font-display font-bold" style={{ fontSize: '0.95rem' }}>LogicBridge</span>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          aria-label="Toggle Color Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
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
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="nav-item w-full"
            style={{ marginBottom: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', justifyContent: 'space-between' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {theme === 'dark' ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#6c63ff" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
          </button>

          {/* User card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 10, padding: '8px 12px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, color: '#fff',
            }}>
              {initial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: '0.8rem', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.name || 'User'}
              </div>
              <div style={{
                fontSize: '0.68rem', color: 'var(--text-muted)',
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
    </>
  );
}

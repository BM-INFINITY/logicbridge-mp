import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, LayoutDashboard, GitBranch, Activity, LogOut, Link2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import API from '../api/client';
import { ConnectionList, ConnectionDialog } from '../components/connections';

/* ─── Shared Sidebar (mirrors DashboardPage / LogsPage) ──────────────────── */
function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard',      path: '/dashboard' },
    { icon: <GitBranch size={18} />,       label: 'Workflows',      path: '/dashboard' },
    { icon: <Activity size={18} />,        label: 'Execution Logs', path: '/logs' },
    { icon: <Link2 size={18} />,           label: 'Connections',    path: '/connections' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="flex items-center gap-2">
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div className="font-display font-bold" style={{ fontSize: '1rem' }}>LogicBridge</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Workflow Engine</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} className="nav-item w-full" style={{ color: 'var(--accent-danger)', display: 'flex', gap: 10 }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ─── ConnectionsPage ────────────────────────────────────────────────────── */
export default function ConnectionsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [connections, setConnections]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showDialog, setShowDialog]     = useState(false);
  const [verifyingId, setVerifyingId]   = useState(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/connections');
      setConnections(data.data || data);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth callback query params (?oauth=success|error|cancelled)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthStatus = params.get('oauth');
    if (!oauthStatus) return;

    if (oauthStatus === 'success') {
      const provider = params.get('provider') || 'account';
      toast.success(`${provider === 'gmail' ? 'Gmail' : provider} connected successfully! 🎉`);
    } else if (oauthStatus === 'cancelled') {
      toast('Sign-in cancelled.', { icon: 'ℹ️' });
    } else if (oauthStatus === 'error') {
      const msg = decodeURIComponent(params.get('msg') || 'OAuth failed');
      toast.error(`Connection failed: ${msg}`);
    }

    // Clean the URL without a page reload
    navigate('/connections', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleCreate = async (payload) => {
    const { data } = await API.post('/api/connections', payload);
    const created = data.data || data;
    toast.success(`"${created.name}" connected successfully`);
    fetchConnections();
  };

  const handleVerify = async (id) => {
    setVerifyingId(id);
    try {
      const { data } = await API.post(`/api/connections/${id}/verify`);
      const result = data.data || data;
      if (result.ok) {
        toast.success('Connection verified ✓');
      } else {
        toast.error(`Verification failed: ${result.message}`);
      }
      fetchConnections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (id) => {
    const conn = connections.find((c) => c._id === id);
    if (!confirm(`Delete connection "${conn?.name || id}"?`)) return;
    try {
      await API.delete(`/api/connections/${id}`);
      toast.success('Connection removed');
      setConnections((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete connection');
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <main className="main-content">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Connections</h1>
            <p className="text-secondary text-sm mt-1">
              Manage your external service accounts and credentials
            </p>
          </div>
          <button
            id="add-connection-btn"
            className="btn btn-primary"
            onClick={() => setShowDialog(true)}
          >
            <Plus size={18} /> Add Connection
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',         value: connections.length,                                           color: '#6c63ff' },
            { label: 'Active',        value: connections.filter((c) => c.status === 'active').length,       color: '#22c55e' },
            { label: 'Disconnected',  value: connections.filter((c) => c.status === 'disconnected').length, color: '#ef4444' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 20px',
                minWidth: 120,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Connection grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <ConnectionList
            connections={connections}
            onVerify={handleVerify}
            onDelete={handleDelete}
            verifyingId={verifyingId}
          />
        )}
      </main>

      {showDialog && (
        <ConnectionDialog
          onClose={() => setShowDialog(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

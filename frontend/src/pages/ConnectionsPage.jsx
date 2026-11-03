import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';
import { ConnectionList, ConnectionDialog } from '../components/connections';
import AppSidebar from '../components/AppSidebar';
import ConfirmDialog from '../components/ConfirmDialog';

/* ─── ConnectionsPage ────────────────────────────────────────────────────── */
export default function ConnectionsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [connections, setConnections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showDialog, setShowDialog]   = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [isDeleting, setIsDeleting]   = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/connections');
      setConnections(data.data || data || []);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── Handle OAuth callback (?oauth=success|error|cancelled) ────────────── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthStatus = params.get('oauth');
    if (!oauthStatus) return;

    if (oauthStatus === 'success') {
      const provider = params.get('provider') || 'account';
      toast.success(`${provider === 'gmail' ? 'Gmail' : provider} connected successfully!`);
    } else if (oauthStatus === 'cancelled') {
      toast('Sign-in cancelled.');
    } else if (oauthStatus === 'error') {
      const msg = decodeURIComponent(params.get('msg') || 'OAuth failed');
      toast.error(`Connection failed: ${msg}`);
    }

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
        toast.success('Connection verified');
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

  const handleConfirmDelete = async () => {
    if (!connectionToDelete) return;
    setIsDeleting(true);
    try {
      await API.delete(`/api/connections/${connectionToDelete._id}`);
      toast.success('Connection removed');
      setConnections((prev) => prev.filter((c) => c._id !== connectionToDelete._id));
      setConnectionToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete connection');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.provider || '').toLowerCase().includes(q)
    );
  }, [connections, searchQuery]);

  return (
    <div className="page-layout">
      <AppSidebar />

      <main className="main-content">
        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Connections</h1>
            <p className="page-header-subtitle">
              Manage external service accounts, credentials, and API authentications
            </p>
          </div>
          <button
            id="add-connection-btn"
            className="btn btn-primary btn-sm"
            onClick={() => setShowDialog(true)}
          >
            <Plus size={16} /> Add Connection
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',        value: connections.length,                                            color: '#6c63ff' },
            { label: 'Active',       value: connections.filter((c) => c.status === 'active').length,       color: '#22c55e' },
            { label: 'Disconnected', value: connections.filter((c) => c.status === 'disconnected').length, color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '12px 18px',
              minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </span>
              <span style={{
                fontSize: '0.72rem', color: 'var(--text-muted)',
                fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Search bar when connections exist */}
        {connections.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="connections-search-input"
                className="form-input"
                style={{ paddingLeft: 32, paddingRight: searchQuery ? 30 : 10, fontSize: '0.82rem', height: 34 }}
                placeholder="Search connections..."
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
                  aria-label="Clear connection search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <span className="text-muted text-xs">
              {filteredConnections.length} of {connections.length}
            </span>
          </div>
        )}

        {/* Connection grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : connections.length > 0 && filteredConnections.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-icon"><Search size={32} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem' }}>No matching connections</h3>
            <p className="text-secondary text-sm">No connections match &ldquo;{searchQuery}&rdquo;.</p>
            <button className="btn btn-secondary btn-sm mt-2" onClick={() => setSearchQuery('')}>
              Clear Search
            </button>
          </div>
        ) : (
          <ConnectionList
            connections={filteredConnections}
            onVerify={handleVerify}
            onDelete={(id) => {
              const conn = connections.find((c) => c._id === id);
              if (conn) setConnectionToDelete(conn);
            }}
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

      {/* Confirmation Dialog for Connection Deletion */}
      <ConfirmDialog
        isOpen={Boolean(connectionToDelete)}
        title="Delete Connection"
        message={`Are you sure you want to remove connection "${connectionToDelete?.name || ''}"? Workflows using this credential will fail until updated.`}
        confirmLabel="Delete Connection"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setConnectionToDelete(null)}
      />
    </div>
  );
}

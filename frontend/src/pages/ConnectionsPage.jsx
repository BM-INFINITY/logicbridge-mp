import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';
import { ConnectionList, ConnectionDialog } from '../components/connections';
import AppSidebar from '../components/AppSidebar';

/* ─── ConnectionsPage ────────────────────────────────────────────────────── */
export default function ConnectionsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [connections, setConnections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showDialog, setShowDialog]   = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

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
      <AppSidebar />

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
            { label: 'Total',        value: connections.length,                                            color: '#6c63ff' },
            { label: 'Active',       value: connections.filter((c) => c.status === 'active').length,       color: '#22c55e' },
            { label: 'Disconnected', value: connections.filter((c) => c.status === 'disconnected').length, color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px 20px',
              minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
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

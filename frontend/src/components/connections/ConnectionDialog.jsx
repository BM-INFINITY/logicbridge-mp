import React, { useState, useEffect } from 'react';
import { X, Plus, Eye, EyeOff, ExternalLink, Mail, Table } from 'lucide-react';
import API from '../../api/client';

/**
 * ConnectionDialog — modal for adding a new connection.
 *
 * - OAuth providers (Gmail): redirect to Google consent screen via window.location
 * - Credential providers (SMTP): render requiredFields form and POST to API
 */
export default function ConnectionDialog({ onClose, onCreate }) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    API.get('/api/connections/providers')
      .then(({ data }) => setProviders(data.data || data))
      .catch(() => setProviders([]))
      .finally(() => setLoadingProviders(false));
  }, []);

  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider);
    setFields({});
    setError('');
    setName(`My ${provider.name}`);
  };

  const handleFieldChange = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const togglePassword = (key) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** OAuth providers redirect to the backend which redirects to Google */
  const handleOAuthConnect = async () => {
    if (!name.trim()) return setError('Connection name is required.');
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/api/oauth/google/url', {
        params: { name, provider: selectedProvider?.id },
      });
      const url = data.data?.url || data.url;
      if (!url) throw new Error('No OAuth URL returned from server');
      // Navigate to Google consent screen
      window.location.href = url;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to initiate Google sign-in');
      setLoading(false);
    }
  };

  /** Credential providers submit directly */
  const handleCredentialSubmit = async () => {
    if (!selectedProvider) return setError('Select a provider first.');
    if (!name.trim()) return setError('Connection name is required.');

    setLoading(true);
    setError('');
    try {
      const credentials = {};
      (selectedProvider.requiredFields || []).forEach((f) => {
        credentials[f.key] = f.type === 'checkbox'
          ? (fields[f.key] === true || fields[f.key] === 'true')
          : (fields[f.key] || '');
      });
      await onCreate({ provider: selectedProvider.id, name, credentials });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create connection');
    } finally {
      setLoading(false);
    }
  };

  const isOAuth = selectedProvider?.supportsOAuth && selectedProvider?.requiredFields?.length === 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Connection</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Connect your external account</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1: Select provider */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Select Provider
            </div>
            {loadingProviders ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading providers…</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {providers.map((p) => (
                  <button
                    key={p.id}
                    id={`provider-select-${p.id}`}
                    onClick={() => handleProviderSelect(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      background: selectedProvider?.id === p.id ? 'rgba(108,99,255,0.15)' : 'var(--bg-elevated)',
                      border: selectedProvider?.id === p.id ? '1px solid rgba(108,99,255,0.5)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem', fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                    {p.name}
                    {p.supportsOAuth && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-secondary)', background: 'rgba(34,211,238,0.1)', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>OAuth</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProvider && (
            <>
              {/* Step 2: Connection name */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. Connection Name
                </div>
                <input
                  id="connection-name-input"
                  className="form-input"
                  placeholder={`e.g. My ${selectedProvider.name}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Gmail OAuth: show consent button */}
              {isOAuth && selectedProvider.id === 'gmail' && (
                <div style={{
                  background: 'rgba(234,67,53,0.07)', border: '1px solid rgba(234,67,53,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234,67,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={20} color="#ea4335" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Sign in with Google</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        You&apos;ll be redirected to Google&apos;s secure sign-in
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    LogicBridge will request permission to <strong>send emails on your behalf</strong>. Your credentials are encrypted and never shared.
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Scopes: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>gmail.send</code>, <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>email</code>, <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>profile</code>
                  </div>
                </div>
              )}

              {/* Google Sheets OAuth: show consent button */}
              {isOAuth && selectedProvider.id === 'google_sheets' && (
                <div style={{
                  background: 'rgba(15,157,88,0.07)', border: '1px solid rgba(15,157,88,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(15,157,88,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Table size={20} color="#0f9d58" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Connect Google Sheets</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        You&apos;ll be redirected to Google&apos;s secure sign-in
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    LogicBridge will request permission to <strong>read, edit, and create Google Sheets</strong>. Your credentials are encrypted and never shared.
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Scopes: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>spreadsheets</code>, <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>drive.file</code>, <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>email</code>, <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>profile</code>
                  </div>
                </div>
              )}

              {/* SMTP credential fields */}
              {!isOAuth && selectedProvider.requiredFields.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    3. Credentials
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedProvider.requiredFields.map((f) => (
                      <div key={f.key} className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" htmlFor={`cred-${f.key}`}>
                          {f.label}{f.required && <span style={{ color: 'var(--accent-danger)', marginLeft: 3 }}>*</span>}
                        </label>
                        {f.type === 'checkbox' ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                            <input
                              id={`cred-${f.key}`}
                              type="checkbox"
                              checked={!!fields[f.key]}
                              onChange={(e) => handleFieldChange(f.key, e.target.checked)}
                              style={{ accentColor: 'var(--accent-primary)', width: 16, height: 16 }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enable</span>
                          </label>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <input
                              id={`cred-${f.key}`}
                              className="form-input"
                              type={f.type === 'password' && !showPasswords[f.key] ? 'password' : f.type === 'number' ? 'number' : 'text'}
                              placeholder={f.placeholder}
                              value={fields[f.key] || ''}
                              onChange={(e) => handleFieldChange(f.key, e.target.value)}
                              style={{ paddingRight: f.type === 'password' ? 40 : undefined }}
                            />
                            {f.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => togglePassword(f.key)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                {showPasswords[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--accent-danger)' }}>
              {error}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {isOAuth ? (
              <button
                id="connection-dialog-oauth-submit"
                onClick={handleOAuthConnect}
                disabled={loading || !name.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#ea4335', border: 'none', borderRadius: 'var(--radius-md)',
                  color: '#fff', fontWeight: 600, fontSize: '0.88rem', padding: '9px 18px',
                  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <><span className="spinner" style={{ borderColor: '#fff3', borderTopColor: '#fff' }} /> Redirecting…</> : <><ExternalLink size={14} /> Continue with Google</>}
              </button>
            ) : (
              <button
                id="connection-dialog-submit"
                className="btn btn-primary"
                onClick={handleCredentialSubmit}
                disabled={loading || !selectedProvider}
              >
                {loading ? <><span className="spinner" /> Connecting…</> : <><Plus size={15} /> Connect</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

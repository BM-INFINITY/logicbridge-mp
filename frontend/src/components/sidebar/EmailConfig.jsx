import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { TextField, CodeEditor } from '../forms';
import API from '../../api/client';

/**
 * EmailConfig — sidebar form for the Email node.
 *
 * Shows a Connection dropdown (Gmail or SMTP connections from the user's account)
 * followed by To, Subject, and Body fields.
 *
 * If no connections are configured the dropdown shows a "No connections" hint
 * with a link to the Connections page.
 */
export default function EmailConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        // Only show active email-type connections
        const emailConns = all.filter((c) =>
          c.status === 'active' && ['gmail', 'smtp', 'outlook'].includes(c.provider)
        );
        setConnections(emailConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => { fetchConnections(); }, []);

  const selectedConn = connections.find((c) => c._id === data.connectionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Connection selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={11} /> Connection
          </label>
          <button
            onClick={fetchConnections}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title="Refresh connections"
          >
            <RefreshCw size={11} style={{ animation: loadingConns ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {connections.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
            fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5,
          }}>
            No active email connections.{' '}
            <a
              href="/connections"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
            >
              Add a connection
            </a>
            {' '}to send from your own account.
          </div>
        ) : (
          <select
            className="form-input"
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">— Use platform SMTP —</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        )}

        {selectedConn && (
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 4, marginTop: -2 }}>
            <span>●</span> Sending from: <strong>{selectedConn.email}</strong>
          </div>
        )}
      </div>

      <TextField
        label="Recipient Email (to)"
        placeholder="user@example.com or {{prev.email}}"
        value={data.to}
        onChange={(val) => updateField('to', val)}
        onInsertVariable={() => onOpenVariablePicker('to')}
      />

      <TextField
        label="Subject Line"
        placeholder="LogicBridge Automated Report - {{prev.date}}"
        value={data.subject}
        onChange={(val) => updateField('subject', val)}
        onInsertVariable={() => onOpenVariablePicker('subject')}
      />

      <CodeEditor
        label="Email Content / Body"
        placeholder={`Hello {{prev.name}},\n\nYour automated report is ready.`}
        value={data.body}
        onChange={(val) => updateField('body', val)}
        onInsertVariable={() => onOpenVariablePicker('body')}
        minHeight={120}
        helperText="Supports plain text or handlebar placeholders like {{prev.field}}"
      />
    </div>
  );
}

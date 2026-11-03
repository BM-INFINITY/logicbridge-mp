import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, MessageSquare, Info } from 'lucide-react';
import { TextField, CodeEditor } from '../forms';
import API from '../../api/client';

const SLACK_OPERATIONS = [
  { value: 'send_message', label: 'Send Channel Message' },
  { value: 'send_dm', label: 'Send Direct Message' },
  { value: 'send_blocks', label: 'Send Rich Message / Blocks' },
  { value: 'get_channel', label: 'Get Channel Information' },
];

export default function SlackConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const slackConns = all.filter(
          (c) => c.status === 'active' && c.provider === 'slack'
        );
        setConnections(slackConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const selectedConn = connections.find((c) => c._id === data.connectionId);
  const currentOp = data.operation || 'send_message';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Connection selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Link2 size={11} /> Slack Connection
          </label>
          <button
            onClick={fetchConnections}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Refresh connections"
          >
            <RefreshCw
              size={11}
              style={{ animation: loadingConns ? 'spin 1s linear infinite' : 'none' }}
            />
          </button>
        </div>

        {connections.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            No active Slack connections.{' '}
            <a
              href="/connections"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
            >
              Add a Slack connection
            </a>{' '}
            with your Bot Token.
          </div>
        ) : (
          <select
            className="form-input"
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">— Select a Slack Connection —</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.metadata?.team ? `(${c.metadata.team})` : ''}
              </option>
            ))}
          </select>
        )}

        {selectedConn && (
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--accent-success)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: -2,
            }}
          >
            <span>●</span> Workspace: <strong>{selectedConn.metadata?.team || selectedConn.name}</strong>
          </div>
        )}
      </div>

      {/* Operation selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <MessageSquare size={11} /> Operation
        </label>
        <select
          className="form-input"
          value={currentOp}
          onChange={(e) => updateField('operation', e.target.value)}
          style={{ fontSize: '0.85rem' }}
        >
          {SLACK_OPERATIONS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Operation specific fields */}
      {(currentOp === 'send_message' || currentOp === 'send_blocks') && (
        <TextField
          label="Channel Name or ID"
          placeholder="#general or C0123456789 or {{prev.channel}}"
          value={data.channel}
          onChange={(val) => updateField('channel', val)}
          onOpenVariablePicker={() => onOpenVariablePicker?.('channel')}
          helperText="Public channel name, private channel ID, or dynamic variable"
        />
      )}

      {currentOp === 'send_dm' && (
        <TextField
          label="Slack User ID"
          placeholder="U0123456789 or {{prev.userId}}"
          value={data.userId}
          onChange={(val) => updateField('userId', val)}
          onOpenVariablePicker={() => onOpenVariablePicker?.('userId')}
          helperText="Target member's Slack user ID (requires im:write scope)"
        />
      )}

      {(currentOp === 'send_message' || currentOp === 'send_dm') && (
        <CodeEditor
          label="Message Text"
          value={data.text || data.message || ''}
          onChange={(val) => updateField('text', val)}
          onInsertVariable={() => onOpenVariablePicker?.('text')}
          placeholder="Hello team! Build {{prev.status}} completed successfully."
          minLines={3}
          maxLines={6}
        />
      )}

      {currentOp === 'send_blocks' && (
        <>
          <TextField
            label="Fallback / Notification Text"
            placeholder="New deployment notification"
            value={data.text}
            onChange={(val) => updateField('text', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('text')}
            helperText="Plaintext summary shown in mobile notifications and previews"
          />
          <CodeEditor
            label="Block Kit Blocks (JSON Array)"
            value={typeof data.blocks === 'object' ? JSON.stringify(data.blocks, null, 2) : (data.blocks || '')}
            onChange={(val) => updateField('blocks', val)}
            onInsertVariable={() => onOpenVariablePicker?.('blocks')}
            placeholder={'[\n  {\n    "type": "section",\n    "text": { "type": "mrkdwn", "text": "*Status:* {{prev.status}}" }\n  }\n]'}
            minLines={4}
            maxLines={10}
            helperText="Valid JSON array of Slack Block Kit block objects"
          />
        </>
      )}

      {currentOp === 'get_channel' && (
        <TextField
          label="Channel ID"
          placeholder="C0123456789 or {{prev.channelId}}"
          value={data.channel || data.channelId}
          onChange={(val) => {
            updateField('channel', val);
            updateField('channelId', val);
          }}
          onOpenVariablePicker={() => onOpenVariablePicker?.('channel')}
          helperText="Requires channels:read or groups:read scope"
        />
      )}

      {(currentOp === 'send_message' || currentOp === 'send_dm' || currentOp === 'send_blocks') && (
        <TextField
          label="Thread Timestamp (thread_ts) — Optional"
          placeholder="{{prev.ts}} or 1609459200.000200"
          value={data.threadTs}
          onChange={(val) => updateField('threadTs', val)}
          onOpenVariablePicker={() => onOpenVariablePicker?.('threadTs')}
          helperText="Provide parent message timestamp to reply in a message thread"
        />
      )}

      {/* Scope helper banner */}
      <div
        style={{
          background: 'rgba(108,99,255,0.06)',
          border: '1px solid rgba(108,99,255,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          fontSize: '0.73rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 6,
          lineHeight: 1.4,
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-primary)' }} />
        <span>
          <strong>Required Bot Scopes:</strong> <code>chat:write</code>, <code>chat:write.public</code> (for channels), <code>im:write</code> (for DMs), <code>channels:read</code> (for info).
        </span>
      </div>
    </div>
  );
}


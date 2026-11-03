import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, MessageCircle, Info } from 'lucide-react';
import { TextField, CodeEditor } from '../forms';
import API from '../../api/client';

const DISCORD_OPERATIONS = [
  { value: 'send_message', label: 'Send Message' },
  { value: 'send_embed', label: 'Send Embed' },
  { value: 'send_webhook', label: 'Send Message using Webhook' },
  { value: 'get_channel', label: 'Get Channel Information' },
];

export default function DiscordConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const discordConns = all.filter(
          (c) => c.status === 'active' && c.provider === 'discord'
        );
        setConnections(discordConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const selectedConn = connections.find((c) => c._id === data.connectionId);
  const isWebhookConn = selectedConn?.metadata?.authType === 'webhook' || Boolean(data.webhookUrl);
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
            <Link2 size={11} /> Discord Connection
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
            No saved Discord connections.{' '}
            <a
              href="/connections"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
            >
              Add a connection
            </a>{' '}
            or enter a direct Webhook URL below.
          </div>
        ) : (
          <select
            className="form-input"
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">— Select a saved Discord Connection —</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.metadata?.authType === 'webhook' ? 'Webhook' : 'Bot Token'})
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
            <span>●</span> Connected as:{' '}
            <strong>
              {selectedConn.metadata?.bot
                ? `@${selectedConn.metadata.bot} (Bot)`
                : selectedConn.metadata?.webhookName || selectedConn.name}
            </strong>
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
          <MessageCircle size={11} /> Operation
        </label>
        <select
          className="form-input"
          value={currentOp}
          onChange={(e) => updateField('operation', e.target.value)}
          style={{ fontSize: '0.85rem' }}
        >
          {DISCORD_OPERATIONS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Direct Webhook override if not using connection */}
      {(!data.connectionId || currentOp === 'send_webhook' || isWebhookConn) && currentOp !== 'get_channel' && (
        <TextField
          label="Webhook URL (optional override)"
          placeholder="https://discord.com/api/webhooks/..."
          value={data.webhookUrl}
          onChange={(val) => updateField('webhookUrl', val)}
          onOpenVariablePicker={() => onOpenVariablePicker?.('webhookUrl')}
          helperText="Direct webhook endpoint from Discord Server Settings → Integrations"
        />
      )}

      {/* Channel ID for Bot connection */}
      {(!isWebhookConn || currentOp === 'get_channel') && currentOp !== 'send_webhook' && (
        <TextField
          label="Discord Channel ID"
          placeholder="123456789012345678 or {{prev.channelId}}"
          value={data.channelId || data.channel}
          onChange={(val) => {
            updateField('channelId', val);
            updateField('channel', val);
          }}
          onOpenVariablePicker={() => onOpenVariablePicker?.('channelId')}
          helperText="Numeric channel ID (enable Developer Mode in Discord to copy)"
        />
      )}

      {/* Message Content */}
      {currentOp !== 'get_channel' && (
        <CodeEditor
          label={currentOp === 'send_embed' ? 'Accompanying Message (Optional)' : 'Message Content'}
          value={data.content || data.text || data.message || ''}
          onChange={(val) => updateField('content', val)}
          onInsertVariable={() => onOpenVariablePicker?.('content')}
          placeholder="Alert: Status check returned {{prev.status}}"
          minLines={2}
          maxLines={6}
        />
      )}

      {/* Embed Fields */}
      {currentOp === 'send_embed' && (
        <>
          <TextField
            label="Embed Title"
            placeholder="🚨 Production Health Alert"
            value={data.title}
            onChange={(val) => updateField('title', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('title')}
          />
          <CodeEditor
            label="Embed Description"
            value={data.description || ''}
            onChange={(val) => updateField('description', val)}
            onInsertVariable={() => onOpenVariablePicker?.('description')}
            placeholder="Incident detected on service {{prev.name}} at {{prev.timestamp}}"
            minLines={3}
            maxLines={6}
          />
          <TextField
            label="Embed Accent Color (Hex)"
            placeholder="#5865f2 or #22c55e"
            value={data.color}
            onChange={(val) => updateField('color', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('color')}
            helperText="Hex color string for the embed side strip"
          />
          <TextField
            label="Footer Text (Optional)"
            placeholder="LogicBridge Automated Notification"
            value={data.footer}
            onChange={(val) => updateField('footer', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('footer')}
          />
        </>
      )}

      {/* Webhook Customization */}
      {currentOp === 'send_webhook' && (
        <>
          <TextField
            label="Bot Username Override (Optional)"
            placeholder="LogicBridge Bot"
            value={data.username}
            onChange={(val) => updateField('username', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('username')}
          />
          <TextField
            label="Avatar Image URL (Optional)"
            placeholder="https://example.com/logo.png"
            value={data.avatarUrl}
            onChange={(val) => updateField('avatarUrl', val)}
            onOpenVariablePicker={() => onOpenVariablePicker?.('avatarUrl')}
          />
        </>
      )}

      {/* Permissions helper banner */}
      <div
        style={{
          background: 'rgba(88,101,242,0.06)',
          border: '1px solid rgba(88,101,242,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          fontSize: '0.73rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 6,
          lineHeight: 1.4,
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: '#5865f2' }} />
        <span>
          <strong>Discord Permissions:</strong> Bots require <code>Send Messages</code>, <code>Embed Links</code>, and <code>View Channel</code> permissions in the target channel.
        </span>
      </div>
    </div>
  );
}


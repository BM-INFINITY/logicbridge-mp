import React, { useState } from 'react';
import {
  Webhook,
  Copy,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TextField, SelectField, SwitchField } from '../forms';
import WebhookEventsModal from '../WebhookEventsModal';

const AUTH_TYPES = [
  { value: 'none', label: 'None (Public Webhook)', hint: 'Anyone with the URL can trigger this workflow' },
  { value: 'bearer', label: 'Bearer Token', hint: 'Requires "Authorization: Bearer <token>" header' },
  { value: 'apiKey', label: 'API Key (Header / Query)', hint: 'Requires API key matching configured header or query param' },
  { value: 'hmac', label: 'HMAC Signature Verification', hint: 'Cryptographically verifies payload signature using secret (e.g. GitHub, Stripe, Shopify)' },
];

const HMAC_ALGORITHMS = [
  { value: 'sha256', label: 'SHA-256 (Recommended)' },
  { value: 'sha512', label: 'SHA-512' },
  { value: 'sha1', label: 'SHA-1' },
];

const HTTP_METHODS = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];

export default function WebhookConfig({ data, onChange, onOpenVariablePicker, workflowId }) {
  const [showEventsModal, setShowEventsModal] = useState(false);
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const authType = data.authType || 'none';
  const selectedAuth = AUTH_TYPES.find((a) => a.value === authType);

  // Compute endpoint URLs
  const baseUrl = window.location.origin;
  const endpointPath = workflowId ? `/api/workflows/${workflowId}/webhook` : '/api/workflows/:workflowId/webhook';
  const fullEndpointUrl = `${baseUrl}${endpointPath}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(fullEndpointUrl);
    toast.success('Webhook URL copied to clipboard!');
  };

  const selectedMethods = Array.isArray(data.methods) && data.methods.length > 0
    ? data.methods
    : [data.method || 'POST'];

  const toggleMethod = (method) => {
    let next = [...selectedMethods];
    if (next.includes(method)) {
      if (next.length > 1) {
        next = next.filter((m) => m !== method);
      } else {
        toast.error('At least one HTTP method must be enabled');
        return;
      }
    } else {
      next.push(method);
    }
    updateField('methods', next);
    updateField('method', next[0]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner & URL Display */}
      <div
        style={{
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 'var(--radius-sm, 6px)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Webhook size={16} color="#22c55e" />
            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#22c55e' }}>Webhook Endpoint</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEventsModal(true)}
            style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <History size={12} /> Deliveries
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            readOnly
            value={fullEndpointUrl}
            style={{
              flex: 1,
              background: 'var(--bg-elevated, #16161a)',
              border: '1px solid var(--border, #2d2d3a)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: '0.74rem',
              color: 'var(--text-secondary, #d1d5db)',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={copyUrl}
            title="Copy Webhook URL"
            style={{ padding: '4px 8px' }}
          >
            <Copy size={13} />
          </button>
        </div>
      </div>

      {/* Enable/Disable Endpoint */}
      <SwitchField
        label="Endpoint Active"
        checked={data.enabled !== false}
        onChange={(val) => updateField('enabled', val)}
        helperText="When disabled, incoming webhooks return 403 Forbidden"
      />

      {/* Allowed HTTP Methods */}
      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: 6 }}>
          Allowed HTTP Methods
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {HTTP_METHODS.map((m) => {
            const active = selectedMethods.includes(m);
            return (
              <button
                type="button"
                key={m}
                onClick={() => toggleMethod(m)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #2d2d3a)',
                  background: active ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-elevated, #16161a)',
                  color: active ? '#22c55e' : 'var(--text-muted, #9ca3af)',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Authentication Mode */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <SelectField
          label="Authentication Security"
          value={authType}
          onChange={(val) => updateField('authType', val)}
          options={AUTH_TYPES.map((a) => ({ value: a.value, label: a.label }))}
        />

        {selectedAuth?.hint && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
              padding: '6px 8px',
              marginTop: 4,
              borderLeft: '2px solid #22c55e',
            }}
          >
            {selectedAuth.hint}
          </div>
        )}
      </div>

      {/* Bearer Token Config */}
      {authType === 'bearer' && (
        <TextField
          label="Expected Bearer Token"
          placeholder="e.g. secret-token-xyz or {{secrets.WEBHOOK_TOKEN}}"
          value={data.authToken || ''}
          onChange={(val) => updateField('authToken', val)}
          onInsertVariable={() => onOpenVariablePicker?.('authToken')}
          helperText="Supports static token or encrypted {{secrets.KEY}} syntax"
        />
      )}

      {/* API Key Config */}
      {(authType === 'apiKey' || authType === 'apikey') && (
        <>
          <TextField
            label="API Key Header Name"
            placeholder="x-api-key"
            value={data.apiKeyHeader || 'x-api-key'}
            onChange={(val) => updateField('apiKeyHeader', val)}
            helperText="Header to inspect for the key (also checks query parameter)"
          />
          <TextField
            label="API Key Value"
            placeholder="e.g. my-secret-api-key or {{secrets.API_KEY}}"
            value={data.apiKeyValue || ''}
            onChange={(val) => updateField('apiKeyValue', val)}
            onInsertVariable={() => onOpenVariablePicker?.('apiKeyValue')}
            helperText="Supports static key or encrypted {{secrets.KEY}} syntax"
          />
        </>
      )}

      {/* HMAC Signature Config */}
      {authType === 'hmac' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 6 }}>
          <SelectField
            label="HMAC Algorithm"
            value={data.hmacAlgorithm || 'sha256'}
            onChange={(val) => updateField('hmacAlgorithm', val)}
            options={HMAC_ALGORITHMS}
          />

          <TextField
            label="HMAC Secret Key"
            placeholder="e.g. whsec_abc123 or {{secrets.WEBHOOK_SECRET}}"
            value={data.hmacSecret || ''}
            onChange={(val) => updateField('hmacSecret', val)}
            onInsertVariable={() => onOpenVariablePicker?.('hmacSecret')}
            helperText="Shared signing secret configured in provider (e.g. GitHub/Stripe)"
          />

          <TextField
            label="Signature Header"
            placeholder="x-hub-signature-256"
            value={data.hmacHeader || 'x-hub-signature-256'}
            onChange={(val) => updateField('hmacHeader', val)}
            helperText="Header containing signature (e.g. x-hub-signature-256, stripe-signature)"
          />

          <TextField
            label="Signature Prefix"
            placeholder="sha256="
            value={data.hmacPrefix !== undefined ? data.hmacPrefix : 'sha256='}
            onChange={(val) => updateField('hmacPrefix', val)}
            helperText='Prefix to strip before verifying (e.g. "sha256=" or leave empty)'
          />

          <SelectField
            label="Signature Encoding"
            value={data.hmacEncoding || 'hex'}
            onChange={(val) => updateField('hmacEncoding', val)}
            options={[
              { value: 'hex', label: 'Hexadecimal (Standard)' },
              { value: 'base64', label: 'Base64' },
            ]}
          />
        </div>
      )}

      {/* Replay Protection */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Replay Protection
        </span>
        <div style={{ marginTop: 6 }}>
          <SwitchField
            label="Enforce Request Timestamp"
            checked={Boolean(data.checkTimestamp)}
            onChange={(val) => updateField('checkTimestamp', val)}
            helperText="Rejects requests if timestamp is expired or skewed beyond tolerance"
          />
        </div>

        {data.checkTimestamp && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <TextField
              label="Timestamp Header"
              placeholder="x-timestamp"
              value={data.timestampHeader || 'x-timestamp'}
              onChange={(val) => updateField('timestampHeader', val)}
            />
            <TextField
              label="Max Age (seconds)"
              placeholder="300"
              value={String(data.maxTimestampAge || 300)}
              onChange={(val) => updateField('maxTimestampAge', parseInt(val, 10) || 300)}
            />
          </div>
        )}
      </div>

      {/* Idempotency & Deduplication */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Idempotency & Deduplication
        </span>
        <div style={{ marginTop: 6 }}>
          <SelectField
            label="Deduplication Key Source"
            value={data.idempotencySource || 'header'}
            onChange={(val) => updateField('idempotencySource', val)}
            options={[
              { value: 'header', label: 'Header (e.g. x-idempotency-key, x-request-id)' },
              { value: 'body', label: 'Body Field (e.g. id, eventId)' },
              { value: 'none', label: 'Disabled (Always Process)' },
            ]}
          />

          {data.idempotencySource !== 'none' && (
            <TextField
              label={data.idempotencySource === 'body' ? 'Body Field Path' : 'Header Name'}
              placeholder={data.idempotencySource === 'body' ? 'id or data.id' : 'x-idempotency-key'}
              value={data.idempotencyField || (data.idempotencySource === 'body' ? 'id' : 'x-idempotency-key')}
              onChange={(val) => updateField('idempotencyField', val)}
              helperText="Duplicate events received with the same key will be safely acknowledged without re-running"
            />
          )}
        </div>
      </div>

      {/* Event Filtering */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Event Filtering
        </span>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TextField
            label="Allowed Event Types"
            placeholder="e.g. order.created, customer.updated"
            value={data.eventTypeFilter || ''}
            onChange={(val) => updateField('eventTypeFilter', val)}
            helperText="Comma-separated list of event names. Leave empty to allow all events."
          />

          {data.eventTypeFilter && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TextField
                label="Event Field Path"
                placeholder="event or type"
                value={data.eventTypePath || 'event'}
                onChange={(val) => updateField('eventTypePath', val)}
              />
              <SelectField
                label="Filter Action"
                value={data.filterAction || 'ignore'}
                onChange={(val) => updateField('filterAction', val)}
                options={[
                  { value: 'ignore', label: 'Ignore (200 OK)' },
                  { value: 'reject', label: 'Reject (400 Bad Request)' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Payload Validation */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Payload Validation
        </span>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TextField
            label="Required Fields"
            placeholder="e.g. id, customer.email, amount"
            value={data.requiredFields || ''}
            onChange={(val) => updateField('requiredFields', val)}
            helperText="Comma-separated field paths that must exist in incoming body"
          />

          <TextField
            label="Max Payload Size (Bytes)"
            placeholder="5242880 (5MB)"
            value={String(data.maxPayloadBytes || 5242880)}
            onChange={(val) => updateField('maxPayloadBytes', parseInt(val, 10) || 5242880)}
            helperText="Default: 5 MB (5,242,880 bytes)"
          />
        </div>
      </div>

      {/* Custom HTTP Response */}
      <div style={{ borderTop: '1px solid var(--border, #2d2d3a)', paddingTop: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          HTTP Response Configuration
        </span>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TextField
            label="Response HTTP Status Code"
            placeholder="200"
            value={String(data.responseStatus || 200)}
            onChange={(val) => updateField('responseStatus', parseInt(val, 10) || 200)}
            helperText="HTTP status returned to sender upon successful receipt (e.g. 200, 201, 202)"
          />

          <TextField
            label="Response Body (JSON)"
            placeholder='{"success": true, "message": "Webhook processed"}'
            value={typeof data.responseBody === 'object' ? JSON.stringify(data.responseBody) : (data.responseBody || '{"success":true,"message":"Webhook received"}')}
            onChange={(val) => updateField('responseBody', val)}
            helperText="Custom JSON payload returned in HTTP response"
          />
        </div>
      </div>

      {/* Deliveries Modal */}
      {showEventsModal && (
        <WebhookEventsModal
          isOpen={showEventsModal}
          onClose={() => setShowEventsModal(false)}
          workflowId={workflowId}
          workflowName={data.label || 'Workflow Webhook'}
        />
      )}
    </div>
  );
}

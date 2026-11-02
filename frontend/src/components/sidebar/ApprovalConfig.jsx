import React from 'react';
import { UserCheck, Shield, Clock } from 'lucide-react';
import { TextField, SelectField } from '../forms';

export default function ApprovalConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Informational Banner */}
      <div
        style={{
          background: 'rgba(236, 72, 153, 0.08)',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <UserCheck size={18} color="#ec4899" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <span style={{ fontWeight: 600, color: '#ec4899' }}>Human Approval Node</span>
          <div style={{ marginTop: 2, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Pauses workflow execution until an authorized reviewer approves or rejects the request via the dashboard.
          </div>
        </div>
      </div>

      {/* Approval Title */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Approval Request Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          {onOpenVariablePicker && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => onOpenVariablePicker('title')}
              style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
            >
              Insert Variable
            </button>
          )}
        </div>
        <TextField
          value={data.title || ''}
          onChange={(val) => updateField('title', val)}
          placeholder="e.g. Approve Invoice #{{variables.invoiceId}}"
        />
      </div>

      {/* Description */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Short Description
          </label>
          {onOpenVariablePicker && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => onOpenVariablePicker('description')}
              style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
            >
              Insert Variable
            </button>
          )}
        </div>
        <TextField
          value={data.description || ''}
          onChange={(val) => updateField('description', val)}
          placeholder="e.g. Requested by {{variables.requesterEmail}}"
        />
      </div>

      {/* Message */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Approval Message / Context
          </label>
          {onOpenVariablePicker && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => onOpenVariablePicker('message')}
              style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
            >
              Insert Variable
            </button>
          )}
        </div>
        <textarea
          className="form-control"
          rows={3}
          value={data.message || ''}
          onChange={(e) => updateField('message', e.target.value)}
          placeholder="Detailed context, links, or instructions for the approver..."
          style={{
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            width: '100%',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Security & Approvers */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Shield size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Authorization & Permissions
          </span>
        </div>

        <TextField
          label="Allowed Approvers"
          value={data.allowedApprovers || ''}
          onChange={(val) => updateField('allowedApprovers', val)}
          placeholder="manager@example.com, finance@example.com"
          hint="Comma-separated emails. Leave empty to allow workflow owner."
        />

        <div style={{ marginTop: 10 }}>
          <TextField
            label="Required Approver Role (Optional)"
            value={data.approverRole || ''}
            onChange={(val) => updateField('approverRole', val)}
            placeholder="e.g. manager, admin, finance_lead"
          />
        </div>
      </div>

      {/* Timeout Configuration */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Clock size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Timeout Behavior
          </span>
        </div>

        <TextField
          label="Timeout (Minutes)"
          type="number"
          value={data.timeoutMinutes || ''}
          onChange={(val) => updateField('timeoutMinutes', val)}
          placeholder="e.g. 1440 (24 hours)"
          hint="Leave empty for indefinite wait."
        />

        <div style={{ marginTop: 10 }}>
          <SelectField
            label="Action on Timeout"
            value={data.timeoutAction || 'reject'}
            onChange={(val) => updateField('timeoutAction', val)}
            options={[
              { value: 'reject', label: 'Auto-Reject (Default)' },
              { value: 'approve', label: 'Auto-Approve' },
            ]}
          />
        </div>
      </div>

      {/* Handles Guide */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Execution Branch Handles:
        </div>
        <div>🟢 <strong>APPROVED</strong> — Triggered when approved</div>
        <div>🔴 <strong>REJECTED</strong> — Triggered when rejected</div>
        <div>🟡 <strong>TIMEOUT</strong> — Triggered if expiration duration passes</div>
      </div>
    </div>
  );
}

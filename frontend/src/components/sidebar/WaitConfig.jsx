import React from 'react';
import { Clock } from 'lucide-react';
import { TextField, SelectField } from '../forms';

const WAIT_TYPES = [
  { value: 'duration', label: 'Duration Delay', hint: 'Wait for a specified number of seconds' },
  { value: 'date', label: 'Until Date / Time', hint: 'Wait until a specific target timestamp or ISO date' },
  { value: 'event', label: 'External Event / Webhook', hint: 'Durable pause until an external webhook or API calls the resume token' },
];

export default function WaitConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const waitType = data.waitType || data.type || 'duration';
  const selectedType = WAIT_TYPES.find((t) => t.value === waitType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner */}
      <div
        style={{
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <Clock size={18} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <span style={{ fontWeight: 600, color: '#0ea5e9' }}>Durable Wait Node</span>
          <div style={{ marginTop: 2, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Pauses workflow execution durably in the database. Does not consume active server memory while waiting.
          </div>
        </div>
      </div>

      {/* Wait Type */}
      <SelectField
        label="Wait Type"
        value={waitType}
        onChange={(val) => updateField('waitType', val)}
        options={WAIT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
      />

      {/* Type Hint */}
      {selectedType && (
        <div
          style={{
            fontSize: '0.73rem',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            borderLeft: '2px solid #0ea5e9',
          }}
        >
          {selectedType.hint}
        </div>
      )}

      {/* Type: Duration */}
      {waitType === 'duration' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Duration (Seconds) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {onOpenVariablePicker && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onOpenVariablePicker('durationSeconds')}
                style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
              >
                Insert Variable
              </button>
            )}
          </div>
          <TextField
            value={data.durationSeconds ?? '60'}
            onChange={(val) => updateField('durationSeconds', val)}
            placeholder="e.g. 60 (1 min), 3600 (1 hour)"
            hint="Supports numbers or expressions like {{variables.waitSecs}}"
          />
        </div>
      )}

      {/* Type: Date */}
      {waitType === 'date' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Wait Until Timestamp <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {onOpenVariablePicker && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onOpenVariablePicker('waitUntil')}
                style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
              >
                Insert Variable
              </button>
            )}
          </div>
          <TextField
            value={data.waitUntil || ''}
            onChange={(val) => updateField('waitUntil', val)}
            placeholder="2026-12-31T23:59:59Z or {{variables.targetDate}}"
            hint="ISO 8601 date string or variable"
          />
        </div>
      )}

      {/* Type: Event */}
      {waitType === 'event' && (
        <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Event Identifier / Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {onOpenVariablePicker && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => onOpenVariablePicker('eventName')}
                  style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
                >
                  Insert Variable
                </button>
              )}
            </div>
            <TextField
              value={data.eventName || ''}
              onChange={(val) => updateField('eventName', val)}
              placeholder="e.g. invoice.paid, delivery.signed"
              hint="Descriptive event name for external resume"
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <TextField
              label="Event Timeout (Minutes, Optional)"
              type="number"
              value={data.timeoutMinutes || ''}
              onChange={(val) => updateField('timeoutMinutes', val)}
              placeholder="e.g. 1440 (24 hours)"
              hint="Routes to Timeout branch if no event arrives before expiration"
            />
          </div>

          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
            }}
          >
            <strong>Resume Webhook Endpoint:</strong>
            <br />
            <code>POST /api/executions/resume/:resumeToken</code>
          </div>
        </>
      )}

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
        <div>🔵 <strong>RESUMED</strong> — Default path when wait duration expires or event arrives</div>
        <div>🟡 <strong>TIMEOUT</strong> — Optional path if external event wait times out</div>
      </div>
    </div>
  );
}

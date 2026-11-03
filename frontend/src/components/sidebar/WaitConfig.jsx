import React from 'react';
import { Clock } from 'lucide-react';
import { TextField, SelectField, NumberField } from '../forms';
import SidebarAlert from './SidebarAlert';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
      {/* Informational Banner */}
      <SidebarAlert
        variant="info"
        icon={<Clock size={18} style={{ color: 'var(--color-info, #0ea5e9)' }} />}
        title="Durable Wait Node"
        message="Pauses workflow execution durably in the database. Does not consume active server memory while waiting."
      />

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
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '6px 10px',
            borderLeft: '2px solid var(--color-info, #0ea5e9)',
            border: '1px solid var(--border)',
            borderLeftWidth: 2,
          }}
        >
          {selectedType.hint}
        </div>
      )}

      {/* Type: Duration */}
      {waitType === 'duration' && (
        <TextField
          label="Duration (Seconds)"
          required
          value={data.durationSeconds ?? '60'}
          onChange={(val) => updateField('durationSeconds', val)}
          onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('durationSeconds')}
          placeholder="e.g. 60 (1 min), 3600 (1 hour)"
          helperText="Supports numbers or expressions like {{variables.waitSecs}}."
        />
      )}

      {/* Type: Date */}
      {waitType === 'date' && (
        <TextField
          label="Wait Until Timestamp (ISO-8601)"
          required
          value={data.untilDate || ''}
          onChange={(val) => updateField('untilDate', val)}
          onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('untilDate')}
          placeholder="2026-12-31T23:59:59Z or {{steps.order.dueAt}}"
          helperText="Must resolve to an ISO-8601 date string or UNIX timestamp."
        />
      )}

      {/* Type: External Event */}
      {waitType === 'event' && (
        <>
          <TextField
            label="Event Name / Match Key"
            required
            value={data.eventName || ''}
            onChange={(val) => updateField('eventName', val)}
            onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('eventName')}
            placeholder="e.g. payment_confirmed or order.shipped"
            helperText="External webhooks call /api/workflows/:id/resume with this match token."
          />

          <TextField
            label="Filter Expression (Optional)"
            value={data.eventFilter || ''}
            onChange={(val) => updateField('eventFilter', val)}
            onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('eventFilter')}
            placeholder="event.data.orderId === '{{steps.trigger.orderId}}'"
            helperText="JavaScript expression evaluated on the incoming payload to confirm match."
          />

          <NumberField
            label="Timeout (Hours)"
            min={1}
            max={720}
            value={data.eventTimeoutHours ?? 24}
            onChange={(val) => updateField('eventTimeoutHours', val)}
            helperText="Maximum window to wait before timing out (Default: 24h)."
          />
        </>
      )}
    </div>
  );
}

import React from 'react';
import { TextField, NumberField } from '../forms';

export default function GeneralConfig({ nodeType, data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {nodeType === 'trigger-schedule' && (
        <TextField
          label="Cron Expression"
          placeholder="0 9 * * *"
          value={data.cron}
          onChange={(val) => updateField('cron', val)}
          helperText="Format: minute hour day-of-month month day-of-week"
        />
      )}

      {nodeType === 'action-log' && (
        <TextField
          label="Log Message"
          placeholder="Log message (use {{prev}} for output)"
          value={data.message}
          onChange={(val) => updateField('message', val)}
          onInsertVariable={() => onOpenVariablePicker('message')}
        />
      )}

      {nodeType === 'action-delay' && (
        <NumberField
          label="Seconds to wait"
          value={data.seconds}
          onChange={(val) => updateField('seconds', val)}
          min={1}
          max={3600}
        />
      )}

      {nodeType === 'trigger-manual' && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Manual trigger node starts the workflow when clicked in the builder interface or via API execution endpoint.
        </div>
      )}

      {nodeType === 'trigger-webhook' && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Webhook trigger node listens for incoming HTTP POST payloads to trigger workflow execution.
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { TextField, CodeEditor } from '../forms';

export default function EmailConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        placeholder="Hello {{prev.name}},\n\nYour automated CSV report is generated."
        value={data.body}
        onChange={(val) => updateField('body', val)}
        onInsertVariable={() => onOpenVariablePicker('body')}
        minHeight={120}
        helperText="Supports plain text or handlebar placeholders like {{prev.field}}"
      />
    </div>
  );
}

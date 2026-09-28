import React from 'react';
import { Braces } from 'lucide-react';
import { SelectField, TextField, SwitchField } from '../forms';

const OPERATIONS = [
  { value: 'parse',     label: 'Parse',           hint: 'Convert a JSON string into an object or array' },
  { value: 'stringify', label: 'Stringify',        hint: 'Serialize an object or array into a JSON string' },
  { value: 'get',       label: 'Get Property',     hint: 'Read a value at a dot-notation path, e.g. user.profile.email' },
  { value: 'set',       label: 'Set Property',     hint: 'Write or overwrite a value at a dot-notation path' },
  { value: 'remove',    label: 'Remove Property',  hint: 'Delete a property at a dot-notation path' },
];

const NEEDS_PATH  = ['get', 'set', 'remove'];
const NEEDS_VALUE = ['set'];

export default function JsonConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation   = data.operation || 'parse';
  const selectedOp  = OPERATIONS.find((o) => o.value === operation);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Operation */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {/* Hint */}
      {selectedOp && (
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)' }}>
          {selectedOp.hint}
        </div>
      )}

      {/* Input — not needed for now (operation reads from prev) but useful for get/set/remove to specify source */}
      <TextField
        label={operation === 'parse' ? 'Input (JSON string or variable)' : 'Input Source (optional)'}
        placeholder={operation === 'parse' ? '{{prev.data}} or {"key":"value"}' : 'Leave blank to use previous node output'}
        value={data.input || ''}
        onChange={(val) => updateField('input', val)}
        onInsertVariable={() => onOpenVariablePicker('input')}
      />

      {/* Property Path */}
      {NEEDS_PATH.includes(operation) && (
        <TextField
          label="Property Path"
          placeholder="user.profile.email"
          value={data.path || ''}
          onChange={(val) => updateField('path', val)}
          onInsertVariable={() => onOpenVariablePicker('path')}
        />
      )}

      {/* Value (set only) */}
      {NEEDS_VALUE.includes(operation) && (
        <TextField
          label="Value"
          placeholder="{{prev.name}} or static value"
          value={data.value || ''}
          onChange={(val) => updateField('value', val)}
          onInsertVariable={() => onOpenVariablePicker('value')}
        />
      )}

      {/* Pretty Print (stringify only) */}
      {operation === 'stringify' && (
        <SwitchField
          label="Pretty Print (indented output)"
          value={data.pretty === true || data.pretty === 'true'}
          onChange={(val) => updateField('pretty', val)}
        />
      )}
    </div>
  );
}

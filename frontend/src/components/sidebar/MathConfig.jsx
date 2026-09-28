import React from 'react';
import { SelectField, TextField } from '../forms';

const OPERATIONS = [
  { value: 'add',        label: 'Add',            hint: 'A + B', binary: true },
  { value: 'subtract',   label: 'Subtract',       hint: 'A − B', binary: true },
  { value: 'multiply',   label: 'Multiply',       hint: 'A × B', binary: true },
  { value: 'divide',     label: 'Divide',         hint: 'A ÷ B  (division by zero returns an error)', binary: true },
  { value: 'modulo',     label: 'Modulo',         hint: 'A % B  (remainder after division)', binary: true },
  { value: 'round',      label: 'Round',          hint: 'Round A to nearest integer', binary: false },
  { value: 'floor',      label: 'Floor',          hint: 'Round A down to nearest integer', binary: false },
  { value: 'ceil',       label: 'Ceil',           hint: 'Round A up to nearest integer', binary: false },
  { value: 'absolute',   label: 'Absolute',       hint: 'Return the absolute value of A', binary: false },
  { value: 'min',        label: 'Min',            hint: 'Return the smaller of A and B', binary: true },
  { value: 'max',        label: 'Max',            hint: 'Return the larger of A and B', binary: true },
  { value: 'percentage', label: 'Percentage',     hint: '(A ÷ B) × 100  — e.g. score/total percentage', binary: true },
];

export default function MathConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation   = data.operation || 'add';
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

      {/* Value A — always shown */}
      <TextField
        label="Value A"
        placeholder="{{prev.price}} or 42"
        value={data.valueA || ''}
        onChange={(val) => updateField('valueA', val)}
        onInsertVariable={() => onOpenVariablePicker('valueA')}
      />

      {/* Value B — shown only for binary operations */}
      {selectedOp?.binary && (
        <TextField
          label="Value B"
          placeholder="{{prev.quantity}} or 10"
          value={data.valueB || ''}
          onChange={(val) => updateField('valueB', val)}
          onInsertVariable={() => onOpenVariablePicker('valueB')}
        />
      )}

      {/* Friendly formula display */}
      {selectedOp && (
        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
          {selectedOp.binary
            ? `Result = ${data.valueA || 'A'} ${selectedOp.hint.split(' ')[0]} ${data.valueB || 'B'}`
            : `Result = ${selectedOp.hint.split(' ').slice(0, -2).join(' ')}(${data.valueA || 'A'})`}
        </div>
      )}
    </div>
  );
}

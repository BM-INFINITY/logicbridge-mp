import React from 'react';
import { SelectField, TextField } from '../forms';

const OPERATIONS = [
  { value: 'now',        label: 'Current Date/Time', hint: 'Returns the current execution timestamp as an ISO-8601 string' },
  { value: 'parse',      label: 'Parse',             hint: 'Parse and validate a date string — returns ISO-8601 string' },
  { value: 'format',     label: 'Format',            hint: 'Format a date using a pattern (e.g. YYYY-MM-DD HH:mm:ss)' },
  { value: 'add',        label: 'Add Time',          hint: 'Add time units (seconds, minutes, hours, days, weeks, months, years) to a date' },
  { value: 'subtract',   label: 'Subtract Time',     hint: 'Subtract time units from a date' },
  { value: 'compare',    label: 'Compare',           hint: 'Compare two dates — returns "before", "equal", or "after"' },
  { value: 'difference', label: 'Difference',        hint: 'Calculate the numeric difference between two dates in a chosen unit' },
];

const UNITS = [
  { value: 'milliseconds', label: 'Milliseconds' },
  { value: 'seconds',      label: 'Seconds' },
  { value: 'minutes',      label: 'Minutes' },
  { value: 'hours',        label: 'Hours' },
  { value: 'days',         label: 'Days' },
  { value: 'weeks',        label: 'Weeks' },
  { value: 'months',       label: 'Months' },
  { value: 'years',        label: 'Years' },
];

const DIFF_UNITS = UNITS.filter((u) => ['milliseconds', 'seconds', 'minutes', 'hours', 'days'].includes(u.value));

// Operations needing single dateInput
const NEEDS_SINGLE_INPUT = ['parse', 'format', 'add', 'subtract'];
// Operations needing amount + unit
const NEEDS_AMOUNT       = ['add', 'subtract'];
// Operations needing two dates
const NEEDS_TWO_DATES    = ['compare', 'difference'];

export default function DateConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation   = data.operation || 'now';
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

      {/* Single date input */}
      {NEEDS_SINGLE_INPUT.includes(operation) && (
        <TextField
          label="Date Input"
          placeholder="{{prev.createdAt}} or 2024-01-01T00:00:00Z"
          value={data.dateInput || ''}
          onChange={(val) => updateField('dateInput', val)}
          onInsertVariable={() => onOpenVariablePicker('dateInput')}
        />
      )}

      {/* Format string (format only) */}
      {operation === 'format' && (
        <TextField
          label="Format Pattern"
          placeholder="YYYY-MM-DD or YYYY-MM-DD HH:mm:ss"
          value={data.dateFormat || 'YYYY-MM-DD'}
          onChange={(val) => updateField('dateFormat', val)}
          helperText="Tokens: YYYY MM DD HH mm ss SSS"
        />
      )}

      {/* Amount + Unit (add/subtract) */}
      {NEEDS_AMOUNT.includes(operation) && (
        <>
          <TextField
            label="Amount"
            placeholder="7 or {{prev.daysToAdd}}"
            value={data.amount || '1'}
            onChange={(val) => updateField('amount', val)}
            onInsertVariable={() => onOpenVariablePicker('amount')}
          />
          <SelectField
            label="Unit"
            value={data.unit || 'days'}
            onChange={(val) => updateField('unit', val)}
            options={UNITS}
          />
        </>
      )}

      {/* Two date inputs (compare / difference) */}
      {NEEDS_TWO_DATES.includes(operation) && (
        <>
          <TextField
            label="Date A"
            placeholder="{{prev.startDate}} or 2024-01-01T00:00:00Z"
            value={data.dateA || ''}
            onChange={(val) => updateField('dateA', val)}
            onInsertVariable={() => onOpenVariablePicker('dateA')}
          />
          <TextField
            label="Date B"
            placeholder="{{prev.endDate}} or 2024-12-31T00:00:00Z"
            value={data.dateB || ''}
            onChange={(val) => updateField('dateB', val)}
            onInsertVariable={() => onOpenVariablePicker('dateB')}
          />
        </>
      )}

      {/* Output unit (difference only) */}
      {operation === 'difference' && (
        <SelectField
          label="Output Unit"
          value={data.outputUnit || 'days'}
          onChange={(val) => updateField('outputUnit', val)}
          options={DIFF_UNITS}
        />
      )}
    </div>
  );
}

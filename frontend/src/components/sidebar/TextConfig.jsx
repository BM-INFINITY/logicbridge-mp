import React from 'react';
import { SelectField, TextField, NumberField } from '../forms';

const OPERATIONS = [
  { value: 'uppercase',  label: 'Uppercase',    hint: 'Convert text to UPPERCASE' },
  { value: 'lowercase',  label: 'Lowercase',    hint: 'Convert text to lowercase' },
  { value: 'trim',       label: 'Trim',         hint: 'Remove leading and trailing whitespace' },
  { value: 'replace',    label: 'Replace',      hint: 'Find and replace all occurrences of a substring' },
  { value: 'contains',   label: 'Contains',     hint: 'Returns true if the text contains the search value' },
  { value: 'startsWith', label: 'Starts With',  hint: 'Returns true if the text starts with the search value' },
  { value: 'endsWith',   label: 'Ends With',    hint: 'Returns true if the text ends with the search value' },
  { value: 'split',      label: 'Split',        hint: 'Split text into an array by a separator' },
  { value: 'join',       label: 'Join',         hint: 'Join an array into text with a separator' },
  { value: 'length',     label: 'Length',       hint: 'Return character count (or array length)' },
  { value: 'substring',  label: 'Substring',    hint: 'Extract a portion of the text by start/end index' },
];

// Which operations need which fields
const NEEDS_FIND       = ['replace'];
const NEEDS_SEARCH     = ['contains', 'startsWith', 'endsWith'];
const NEEDS_SEPARATOR  = ['split', 'join'];
const NEEDS_RANGE      = ['substring'];

export default function TextConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation   = data.operation || 'uppercase';
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

      {/* Input — always required */}
      <TextField
        label={operation === 'join' ? 'Input Array (variable)' : 'Input Text'}
        placeholder={operation === 'join' ? '{{prev.data}} (array)' : '{{prev.name}} or plain text'}
        value={data.input || ''}
        onChange={(val) => updateField('input', val)}
        onInsertVariable={() => onOpenVariablePicker('input')}
      />

      {/* Find (replace) */}
      {NEEDS_FIND.includes(operation) && (
        <TextField
          label="Find"
          placeholder="Text to find"
          value={data.find || ''}
          onChange={(val) => updateField('find', val)}
        />
      )}

      {/* Replace With (replace) */}
      {NEEDS_FIND.includes(operation) && (
        <TextField
          label="Replace With"
          placeholder="Replacement text or {{variable}}"
          value={data.replace || ''}
          onChange={(val) => updateField('replace', val)}
          onInsertVariable={() => onOpenVariablePicker('replace')}
        />
      )}

      {/* Search (contains / startsWith / endsWith) */}
      {NEEDS_SEARCH.includes(operation) && (
        <TextField
          label="Search Value"
          placeholder="Text to search for or {{variable}}"
          value={data.search || ''}
          onChange={(val) => updateField('search', val)}
          onInsertVariable={() => onOpenVariablePicker('search')}
        />
      )}

      {/* Separator (split / join) */}
      {NEEDS_SEPARATOR.includes(operation) && (
        <TextField
          label="Separator"
          placeholder={operation === 'split' ? ',' : '-'}
          value={data.separator ?? ','}
          onChange={(val) => updateField('separator', val)}
        />
      )}

      {/* Start/End indices (substring) */}
      {NEEDS_RANGE.includes(operation) && (
        <>
          <NumberField
            label="Start Index"
            value={data.start ?? '0'}
            onChange={(val) => updateField('start', val)}
            helperText="0-based start index (inclusive)"
          />
          <NumberField
            label="End Index (optional)"
            value={data.end ?? ''}
            onChange={(val) => updateField('end', val)}
            helperText="0-based end index (exclusive). Leave blank for end of string."
          />
        </>
      )}
    </div>
  );
}

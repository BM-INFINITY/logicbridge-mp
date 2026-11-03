import React from 'react';
import { SelectField, TextField, CodeEditor, NumberField } from '../forms';

const OPERATIONS = [
  { value: 'loop_items', label: 'Loop Over Items', hint: 'Iterates through each element in an array sequentially' },
  { value: 'loop_batch', label: 'Batch Processing', hint: 'Processes items in fixed-size chunks to manage rate limits and memory' },
  { value: 'loop_range', label: 'Numeric Range', hint: 'Iterates across a numeric range from start to count' },
];

const ERROR_STRATEGIES = [
  { value: 'stop', label: 'Stop on Error (Strict)', hint: 'Immediately halt workflow execution if any iteration fails' },
  { value: 'continue', label: 'Continue on Error (Resilient)', hint: 'Record the failed item and continue processing remaining items' },
];

export default function LoopConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation = data.operation || 'loop_items';
  const selectedOp = OPERATIONS.find((o) => o.value === operation);
  const onError = data.onError || 'stop';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
      {/* Operation */}
      <SelectField
        label="Loop Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {/* Operation Hint */}
      {selectedOp && (
        <div
          style={{
            fontSize: '0.73rem',
            color: 'var(--text-muted)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '6px 10px',
            borderLeft: '2px solid #06b6d4',
          }}
        >
          {selectedOp.hint}
        </div>
      )}

      {/* Items / Array Input for loop_items and loop_batch */}
      {operation !== 'loop_range' && (
        <CodeEditor
          label="Items / Collection Expression"
          required
          placeholder='e.g. {{ steps.http_step.data.users }} or ["item1", "item2"]'
          value={typeof data.items === 'object' ? JSON.stringify(data.items, null, 2) : (data.items || '')}
          onChange={(val) => updateField('items', val)}
          onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('items')}
          minLines={3}
          helperText="Pass a variable expression resolving to an Array or an inline JSON array."
        />
      )}

      {/* Range inputs */}
      {operation === 'loop_range' && (
        <>
          <TextField
            label="Total Count / Limit"
            type="number"
            placeholder="e.g. 5 or {{ steps.calc.count }}"
            value={data.count ?? data.times ?? ''}
            onChange={(val) => updateField('count', val)}
            onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('count')}
            helperText="Number of iterations to perform."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <NumberField
              label="Start Number"
              placeholder="0"
              value={data.start ?? 0}
              onChange={(val) => updateField('start', val)}
            />
            <NumberField
              label="Step Increment"
              placeholder="1"
              value={data.step ?? 1}
              onChange={(val) => updateField('step', val)}
            />
          </div>
        </>
      )}

      {/* Batch size */}
      {operation === 'loop_batch' && (
        <NumberField
          label="Batch / Chunk Size"
          min={1}
          max={500}
          value={data.batchSize ?? 10}
          onChange={(val) => updateField('batchSize', val)}
          helperText="Number of items to group and execute per batch iteration."
        />
      )}

      {/* Error handling strategy */}
      <SelectField
        label="On-Error Strategy"
        value={onError}
        onChange={(val) => updateField('onError', val)}
        options={ERROR_STRATEGIES}
        helperText={ERROR_STRATEGIES.find((s) => s.value === onError)?.hint}
      />
    </div>
  );
}

import React from 'react';
import { Info } from 'lucide-react';
import { SelectField, TextField, CodeEditor } from '../forms';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            borderLeft: '2px solid #06b6d4',
          }}
        >
          {selectedOp.hint}
        </div>
      )}

      {/* Items / Array Input for loop_items and loop_batch */}
      {operation !== 'loop_range' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Items / Collection Expression
            </label>
            {onOpenVariablePicker && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onOpenVariablePicker('items')}
                style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto' }}
              >
                + Variable
              </button>
            )}
          </div>
          <CodeEditor
            placeholder='e.g. {{ steps.http_step.data.users }} or ["item1", "item2"]'
            value={typeof data.items === 'object' ? JSON.stringify(data.items, null, 2) : (data.items || '')}
            onChange={(val) => updateField('items', val)}
            minLines={3}
            maxLines={6}
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Pass a variable expression resolving to an Array or inline JSON array.
          </div>
        </div>
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
            onInsertVariable={() => onOpenVariablePicker('count')}
            helperText="Number of iterations to perform."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TextField
              label="Start Number"
              type="number"
              placeholder="0"
              value={data.start ?? 0}
              onChange={(val) => updateField('start', val)}
            />
            <TextField
              label="Step Increment"
              type="number"
              placeholder="1"
              value={data.step ?? 1}
              onChange={(val) => updateField('step', val)}
            />
          </div>
        </>
      )}

      {/* Batch Size (shown for loop_batch or optional for loop_items) */}
      {(operation === 'loop_batch' || data.batchSize > 1) && (
        <TextField
          label="Batch Size"
          type="number"
          placeholder="e.g. 10"
          value={data.batchSize ?? 1}
          onChange={(val) => updateField('batchSize', val ? parseInt(val, 10) : 1)}
          helperText="Group items into chunks of this size. Downstream nodes receive {{ loop.batch }}."
        />
      )}

      {/* Error Behavior */}
      <SelectField
        label="Error Behavior"
        value={onError}
        onChange={(val) => updateField('onError', val)}
        options={ERROR_STRATEGIES.map((s) => ({ value: s.value, label: s.label }))}
      />

      {/* Maximum Iterations Guard */}
      <TextField
        label="Max Iterations Limit"
        type="number"
        placeholder="500"
        value={data.maxIterations ?? 500}
        onChange={(val) => updateField('maxIterations', val ? parseInt(val, 10) : 500)}
        helperText="Safety limit to prevent uncontrolled or infinite loop execution (max: 2000)."
      />

      {/* Variable Quick Reference */}
      <div
        style={{
          background: 'rgba(6,182,212,0.06)',
          border: '1px solid rgba(6,182,212,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: 10,
          fontSize: '0.73rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#06b6d4' }}>
          <Info size={14} /> Loop Variable Guide
        </div>
        <div><strong>Inside Loop Body (LOOP branch):</strong></div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-primary)', paddingLeft: 6 }}>
          • <code>{'{{ loop.item }}'}</code> / <code>{'{{ item }}'}</code> — Current item<br />
          • <code>{'{{ loop.item.id }}'}</code> — Nested field<br />
          • <code>{'{{ loop.index }}'}</code> / <code>{'{{ index }}'}</code> — 0-based index<br />
          • <code>{'{{ loop.batch }}'}</code> — Array in current batch<br />
          • <code>{'{{ loop.total }}'}</code> — Total items
        </div>
        <div style={{ marginTop: 2 }}><strong>After Loop (DONE branch):</strong></div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-primary)', paddingLeft: 6 }}>
          • <code>{'{{ prev.results }}'}</code> — Aggregated iteration outputs<br />
          • <code>{'{{ prev.total }}'}</code> — Total items processed
        </div>
      </div>
    </div>
  );
}

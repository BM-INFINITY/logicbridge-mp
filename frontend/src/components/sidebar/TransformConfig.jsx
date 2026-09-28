import React, { useState } from 'react';
import { Trash2, Braces } from 'lucide-react';
import { SelectField, TextField } from '../forms';

const OPERATIONS = [
  { value: 'map',          label: 'Map / Rename Fields',    hint: 'Extract and rename fields into a new object' },
  { value: 'pick',         label: 'Pick Fields',            hint: 'Keep only the listed fields from input' },
  { value: 'omit',         label: 'Omit Fields',            hint: 'Remove listed fields, pass through the rest' },
  { value: 'set',          label: 'Set / Extend',           hint: 'Add or overwrite fields on the input object' },
  { value: 'remove',       label: 'Remove Fields',          hint: 'Delete specific fields from the object' },
  { value: 'array-map',    label: 'Array: Map Each Item',   hint: 'Apply field mapping to every item in an array' },
  { value: 'array-filter', label: 'Array: Filter',          hint: 'Keep array items where a field equals a value' },
  { value: 'array-find',   label: 'Array: Find First',      hint: 'Return first item where a field equals a value' },
  { value: 'array-first',  label: 'Array: First Item',      hint: 'Return the first element of an array' },
  { value: 'array-last',   label: 'Array: Last Item',       hint: 'Return the last element of an array' },
  { value: 'array-length', label: 'Array: Length / Count',  hint: 'Return the number of elements in an array' },
];

const MAPPING_OPS = ['map', 'set', 'array-map'];
const FIELD_OPS   = ['pick', 'omit', 'remove'];
const FILTER_OPS  = ['array-filter', 'array-find'];

export default function TransformConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const operation = data.operation || 'map';
  const mappings  = data.mappings  || [];
  const fields    = data.fields    || [];

  const selectedOp = OPERATIONS.find((o) => o.value === operation);

  // ── Mappings (map / set / array-map) ─────────────────────────────────────
  const handleMappingChange = (idx, key, val) => {
    const updated = [...mappings];
    updated[idx] = { ...updated[idx], [key]: val };
    updateField('mappings', updated);
  };
  const handleAddMapping   = () => updateField('mappings', [...mappings, { outputField: '', source: '' }]);
  const handleRemoveMapping = (idx) => updateField('mappings', mappings.filter((_, i) => i !== idx));

  // ── Fields (pick / omit / remove) ────────────────────────────────────────
  const handleFieldChange  = (idx, val) => {
    const updated = [...fields];
    updated[idx] = val;
    updateField('fields', updated);
  };
  const handleAddField    = () => updateField('fields', [...fields, '']);
  const handleRemoveField = (idx) => updateField('fields', fields.filter((_, i) => i !== idx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Operation Selector */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {selectedOp && (
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)' }}>
          {selectedOp.hint}
        </div>
      )}

      {/* Optional: explicit source expression */}
      <TextField
        label="Input Source (optional)"
        placeholder="Leave blank to use previous node output, or {{steps.n1.data}}"
        value={data.source || ''}
        onChange={(val) => updateField('source', val)}
        onInsertVariable={() => onOpenVariablePicker('source')}
      />

      {/* ── Mappings section ───────────────────────────────────────────── */}
      {MAPPING_OPS.includes(operation) && (
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>
              Field Mappings
            </label>
            <button
              type="button"
              onClick={handleAddMapping}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              + Add Field
            </button>
          </div>

          {mappings.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
              No mappings yet — click "+ Add Field" to start
            </div>
          )}

          {mappings.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: '0.75rem', padding: '5px' }}
                placeholder="outputField"
                value={m.outputField || ''}
                onChange={(e) => handleMappingChange(i, 'outputField', e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>←</span>
              <div style={{ position: 'relative', flex: 1.5, display: 'flex', alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.75rem', padding: '5px', paddingRight: '24px' }}
                  placeholder="{{prev.fieldName}} or static value"
                  value={m.source || ''}
                  onChange={(e) => handleMappingChange(i, 'source', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => onOpenVariablePicker(`mappings[${i}].source`)}
                  style={{ position: 'absolute', right: 4, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  title="Insert variable"
                >
                  <Braces size={12} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveMapping(i)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 2 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Fields section (pick / omit / remove) ─────────────────────────── */}
      {FIELD_OPS.includes(operation) && (
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>
              Field Names
            </label>
            <button
              type="button"
              onClick={handleAddField}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              + Add Field
            </button>
          </div>

          {fields.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
              No fields yet — click "+ Add Field" to list which fields to {operation}
            </div>
          )}

          {fields.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: '0.75rem', padding: '5px' }}
                placeholder="fieldName"
                value={f || ''}
                onChange={(e) => handleFieldChange(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveField(i)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 2 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Array filter/find fields ────────────────────────────────────────── */}
      {FILTER_OPS.includes(operation) && (
        <>
          <TextField
            label="Filter Field"
            placeholder="active (field name on each array item)"
            value={data.filterField || ''}
            onChange={(val) => updateField('filterField', val)}
          />
          <TextField
            label="Match Value"
            placeholder="true or {{steps.n1.data.expected}}"
            value={data.filterValue || ''}
            onChange={(val) => updateField('filterValue', val)}
            onInsertVariable={() => onOpenVariablePicker('filterValue')}
          />
        </>
      )}
    </div>
  );
}

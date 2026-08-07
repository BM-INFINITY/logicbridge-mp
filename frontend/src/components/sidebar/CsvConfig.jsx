import React from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { TextField, SelectField } from '../forms';

export default function CsvConfig({ data, onChange, onAutoDetect, autoDetecting, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const columns = data.columns || [];

  const handleColumnChange = (idx, field, val) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: val };
    updateField('columns', updated);
  };

  const handleAddColumn = () => updateField('columns', [...columns, { header: '', value: '' }]);
  const handleRemoveColumn = (idx) => updateField('columns', columns.filter((_, i) => i !== idx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="form-label" style={{ margin: 0 }}>CSV Column Definitions</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              onClick={onAutoDetect}
              disabled={autoDetecting}
            >
              {autoDetecting ? <span className="spinner" /> : <Sparkles size={11} />} Auto-detect
            </button>
            <button
              type="button"
              onClick={handleAddColumn}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              + Column
            </button>
          </div>
        </div>

        {columns.map((col, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '5px' }}
              placeholder="Header Name"
              value={col.header || ''}
              onChange={(e) => handleColumnChange(i, 'header', e.target.value)}
            />
            <input
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '5px' }}
              placeholder="{{ Field }}"
              value={col.value || ''}
              onChange={(e) => handleColumnChange(i, 'value', e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleRemoveColumn(i)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <TextField
        label="Array JSON Path (Optional)"
        placeholder="records or data"
        value={data.arrayPath}
        onChange={(val) => updateField('arrayPath', val)}
        helperText="Dot-notation path if root response is an object"
      />

      <SelectField
        label="Delimiter"
        value={data.delimiter || ','}
        onChange={(val) => updateField('delimiter', val)}
        options={[
          { label: 'Comma (,)', value: ',' },
          { label: 'Semicolon (;)', value: ';' },
          { label: 'Tab (\\t)', value: '\t' },
          { label: 'Pipe (|)', value: '|' },
        ]}
      />

      <TextField
        label="Filename (without extension)"
        placeholder="student_attendance_report"
        value={data.filename}
        onChange={(val) => updateField('filename', val)}
        onInsertVariable={() => onOpenVariablePicker('filename')}
      />
    </div>
  );
}

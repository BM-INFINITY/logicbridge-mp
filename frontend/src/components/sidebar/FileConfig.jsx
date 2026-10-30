import React from 'react';
import { HardDrive, ShieldAlert, FileText } from 'lucide-react';
import { SelectField, TextField, SwitchField, CodeEditor } from '../forms';

const OPERATIONS = [
  { value: 'read_file',    label: 'Read File',           hint: 'Load and parse content from a file in persistent storage' },
  { value: 'write_file',   label: 'Write File',          hint: 'Write or append text, JSON, CSV, or binary content to storage' },
  { value: 'create_file',  label: 'Create File',         hint: 'Create a new file with optional initial content' },
  { value: 'delete_file',  label: 'Delete File',         hint: 'Remove a file from persistent storage' },
  { value: 'get_metadata', label: 'Get File Metadata',   hint: 'Inspect file size, extension, MIME type, and modified timestamps' },
  { value: 'move_file',    label: 'Move / Rename File',  hint: 'Relocate or rename a file within persistent storage' },
];

const FORMATS = [
  { value: 'text',   label: 'Text (UTF-8)' },
  { value: 'json',   label: 'JSON (Parsed object/array)' },
  { value: 'csv',    label: 'CSV (Parsed records)' },
  { value: 'binary', label: 'Binary (Base64 encoded)' },
];

export default function FileConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });
  const operation = data.operation || 'read_file';
  const selectedOp = OPERATIONS.find((o) => o.value === operation);
  const format = data.format || 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Operation */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {/* Operation Hint */}
      {selectedOp && (
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)' }}>
          {selectedOp.hint}
        </div>
      )}

      {/* File Path (for all operations except move_file source) */}
      {operation !== 'move_file' && (
        <TextField
          label="File Path / Name"
          placeholder="e.g. exports/data.csv or {{ steps.prev.filename }}"
          value={data.path || ''}
          onChange={(val) => updateField('path', val)}
          onInsertVariable={() => onOpenVariablePicker('path')}
          helperText="Relative to persistent storage root. Path traversal (../) is prevented."
        />
      )}

      {/* Move/Rename Source & Destination */}
      {operation === 'move_file' && (
        <>
          <TextField
            label="Source File Path"
            placeholder="e.g. incoming/data.csv"
            value={data.sourcePath || data.path || ''}
            onChange={(val) => updateField('sourcePath', val)}
            onInsertVariable={() => onOpenVariablePicker('sourcePath')}
          />
          <TextField
            label="Destination File Path"
            placeholder="e.g. processed/data_2026.csv"
            value={data.destinationPath || ''}
            onChange={(val) => updateField('destinationPath', val)}
            onInsertVariable={() => onOpenVariablePicker('destinationPath')}
          />
          <SwitchField
            label="Overwrite Destination If Exists"
            checked={Boolean(data.overwrite)}
            onChange={(val) => updateField('overwrite', val)}
          />
        </>
      )}

      {/* Format Selection (for Read, Write, and Create) */}
      {['read_file', 'write_file', 'create_file'].includes(operation) && (
        <SelectField
          label="File Format"
          value={format}
          onChange={(val) => updateField('format', val)}
          options={FORMATS}
        />
      )}

      {/* Write File: Content and Options */}
      {operation === 'write_file' && (
        <>
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Content / Data Template</label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onOpenVariablePicker('content')}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                + Variable
              </button>
            </div>
            <textarea
              className="form-input"
              rows={5}
              placeholder={format === 'json' ? '{"key": "{{prev.value}}"}' : format === 'csv' ? 'id,name\n1,Alice' : 'File body text or {{steps.csv_1}}'}
              value={data.content || ''}
              onChange={(e) => updateField('content', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Supports raw strings, JSON/CSV structures, or file references from prior steps.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <SwitchField
                label="Append Mode"
                checked={Boolean(data.append)}
                onChange={(val) => updateField('append', val)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <SwitchField
                label="Overwrite Existing"
                checked={data.overwrite !== false}
                onChange={(val) => updateField('overwrite', val)}
              />
            </div>
          </div>
        </>
      )}

      {/* Create File: Initial Content */}
      {operation === 'create_file' && (
        <>
          <TextField
            label="Initial Content (optional)"
            placeholder="Initial text content or leave blank for empty file"
            value={data.initialContent || ''}
            onChange={(val) => updateField('initialContent', val)}
            onInsertVariable={() => onOpenVariablePicker('initialContent')}
          />
          <SwitchField
            label="Fail If File Already Exists"
            checked={Boolean(data.failIfExists)}
            onChange={(val) => updateField('failIfExists', val)}
          />
        </>
      )}

      {/* Delete File: Ignore Missing */}
      {operation === 'delete_file' && (
        <SwitchField
          label="Ignore If Missing (No Error on 404)"
          checked={Boolean(data.ignoreMissing)}
          onChange={(val) => updateField('ignoreMissing', val)}
        />
      )}

      {/* Security Callout */}
      <div style={{
        marginTop: 6,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(16, 185, 129, 0.06)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        <HardDrive size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong>Persistent Storage Sandboxing:</strong> All file paths are strictly confined to the application&apos;s persistent storage volume. Path traversal outside the storage root is prohibited.
        </div>
      </div>
    </div>
  );
}


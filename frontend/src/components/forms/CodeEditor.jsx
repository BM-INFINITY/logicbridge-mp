import React from 'react';

export default function CodeEditor({
  label,
  value,
  onChange,
  placeholder = '',
  minHeight = 80,
  onInsertVariable,
  helperText,
}) {
  return (
    <div className="form-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {label && <label className="form-label">{label}</label>}
        {onInsertVariable && (
          <button
            type="button"
            onClick={onInsertVariable}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Variable
          </button>
        )}
      </div>
      <textarea
        className="form-input"
        style={{
          fontSize: '0.78rem',
          padding: '8px 10px',
          minHeight,
          fontFamily: 'monospace',
        }}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

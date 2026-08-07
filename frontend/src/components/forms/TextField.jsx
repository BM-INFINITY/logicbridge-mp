import React from 'react';

export default function TextField({
  label,
  value,
  onChange,
  placeholder = '',
  onInsertVariable,
  monospace = false,
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
      <input
        type="text"
        className="form-input"
        style={{
          fontSize: '0.8rem',
          padding: '7px 10px',
          fontFamily: monospace ? 'monospace' : 'inherit',
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

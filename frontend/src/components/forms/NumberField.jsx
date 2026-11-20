import React from 'react';

/**
 * Standardized NumberField component with design-token styling and accessible labels.
 */
export default function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  helperText,
  error,
  required = false,
  disabled = false,
  style = {},
  inputStyle = {},
}) {
  return (
    <div className="form-group" style={{ width: '100%', minWidth: 0, ...style }}>
      {label && (
        <label
          className="form-label"
          style={{
            margin: '0 0 2px 0',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: error ? 'var(--accent-danger, #ef4444)' : 'var(--text-secondary)',
          }}
          title={typeof label === 'string' ? label : undefined}
        >
          {label} {required && <span style={{ color: 'var(--accent-danger)' }}>*</span>}
        </label>
      )}
      <input
        type="number"
        className="form-input"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '0.8rem',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm, 8px)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: error ? '1px solid var(--accent-danger, #ef4444)' : '1px solid var(--border)',
          ...inputStyle,
        }}
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? '' : Number(e.target.value);
          onChange(val);
        }}
        disabled={disabled}
      />
      {error ? (
        <div role="alert" style={{ fontSize: '0.72rem', color: 'var(--accent-danger, #ef4444)', marginTop: 4, lineHeight: 1.4, fontWeight: 500 }}>
          {error}
        </div>
      ) : helperText ? (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}

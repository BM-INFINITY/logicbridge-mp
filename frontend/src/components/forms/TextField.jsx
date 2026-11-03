import React from 'react';

/**
 * Standardized TextField component with non-clipping variable insertion button,
 * accessible label truncation, and design-token styling.
 */
export default function TextField({
  label,
  value,
  onChange,
  placeholder = '',
  onInsertVariable,
  onOpenVariablePicker,
  monospace = false,
  helperText,
  type = 'text',
  disabled = false,
  required = false,
  style = {},
  inputStyle = {},
  min,
  max,
  step,
}) {
  const handleVariableClick = onInsertVariable || onOpenVariablePicker;

  return (
    <div className="form-group" style={{ width: '100%', minWidth: 0, ...style }}>
      {(label || handleVariableClick) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minWidth: 0,
            width: '100%',
            marginBottom: 2,
          }}
        >
          {label && (
            <label
              className="form-label"
              style={{
                margin: 0,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
              title={typeof label === 'string' ? label : undefined}
            >
              {label} {required && <span style={{ color: 'var(--accent-danger)' }}>*</span>}
            </label>
          )}
          {handleVariableClick && (
            <button
              type="button"
              onClick={handleVariableClick}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '2px 4px',
                borderRadius: 'var(--radius-xs, 4px)',
                whiteSpace: 'nowrap',
              }}
              title="Insert variable expression"
            >
              + Variable
            </button>
          )}
        </div>
      )}
      <input
        type={type}
        className="form-input"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '0.8rem',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm, 8px)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          fontFamily: monospace ? 'monospace' : 'inherit',
          ...inputStyle,
        }}
        placeholder={placeholder}
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
      />
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

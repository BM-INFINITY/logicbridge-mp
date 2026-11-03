import React from 'react';

/**
 * Standardized SelectField component with design-token styling and accessible labels.
 */
export default function SelectField({
  label,
  value,
  onChange,
  options = [],
  helperText,
  required = false,
  disabled = false,
  style = {},
  selectStyle = {},
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
            color: 'var(--text-secondary)',
          }}
          title={typeof label === 'string' ? label : undefined}
        >
          {label} {required && <span style={{ color: 'var(--accent-danger)' }}>*</span>}
        </label>
      )}
      <select
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
          outline: 'none',
          ...selectStyle,
        }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

import React from 'react';

/**
 * Standardized CodeEditor component with non-clipping variable insertion button,
 * accessible label truncation, and design-token styling.
 */
export default function CodeEditor({
  label,
  value,
  onChange,
  placeholder = '',
  minHeight = 80,
  minLines,
  maxLines,
  onInsertVariable,
  onOpenVariablePicker,
  helperText,
  required = false,
  style = {},
  textareaStyle = {},
}) {
  const handleVariableClick = onInsertVariable || onOpenVariablePicker;
  const computedMinHeight = minLines ? minLines * 20 + 16 : minHeight;
  const computedMaxHeight = maxLines ? maxLines * 20 + 16 : undefined;

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
      <textarea
        className="form-input"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '0.78rem',
          padding: '8px 10px',
          minHeight: computedMinHeight,
          maxHeight: computedMaxHeight,
          fontFamily: 'monospace',
          borderRadius: 'var(--radius-sm, 8px)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          lineHeight: 1.5,
          resize: 'vertical',
          ...textareaStyle,
        }}
        rows={minLines || 3}
        placeholder={placeholder}
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

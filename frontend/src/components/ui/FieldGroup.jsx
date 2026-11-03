import React from 'react';

/**
 * Standard FieldGroup wrapper providing uniform label, variable action button slot,
 * helper text, and validation error messages across forms and sidebars.
 */
export default function FieldGroup({
  label,
  required = false,
  helperText,
  error,
  action,
  children,
  htmlFor,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`form-group ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      {(label || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minWidth: 0,
            width: '100%',
          }}
        >
          {label && (
            <label
              htmlFor={htmlFor}
              className="form-label"
              style={{
                margin: 0,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: error ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)',
              }}
              title={typeof label === 'string' ? label : undefined}
            >
              {label} {required && <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>}
            </label>
          )}

          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}

      {children}

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: '0.74rem',
            color: 'var(--color-danger, #ef4444)',
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}


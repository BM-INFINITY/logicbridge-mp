import React from 'react';
import { Check, Minus } from 'lucide-react';

/**
 * Standard accessible Checkbox component with custom styling and design tokens.
 */
export default function Checkbox({
  checked = false,
  indeterminate = false,
  onChange,
  label,
  helperText,
  disabled = false,
  id,
  name,
  className = '',
  style = {},
}) {
  const checkboxId = id || (name ? `checkbox-${name}` : undefined);

  const handleClick = () => {
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (disabled || !onChange) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const isCheckedOrIndeterminate = checked || indeterminate;

  return (
    <div
      className={`checkbox-wrapper ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        ...style,
      }}
      onClick={handleClick}
    >
      <div
        role="checkbox"
        id={checkboxId}
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-disabled={disabled ? 'true' : undefined}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-xs, 4px)',
          border: '1.5px solid',
          borderColor: isCheckedOrIndeterminate ? 'var(--accent-primary)' : 'var(--border-strong, var(--border))',
          background: isCheckedOrIndeterminate ? 'var(--accent-primary)' : 'var(--bg-elevated)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          transition: 'all var(--transition)',
          boxShadow: isCheckedOrIndeterminate ? '0 0 10px rgba(108, 99, 255, 0.3)' : 'none',
        }}
      >
        {indeterminate ? (
          <Minus size={13} strokeWidth={3} />
        ) : checked ? (
          <Check size={13} strokeWidth={3} />
        ) : null}
      </div>

      {(label || helperText) && (
        <div style={{ minWidth: 0 }}>
          {label && (
            <label
              htmlFor={checkboxId}
              style={{
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'block',
                lineHeight: 1.4,
              }}
            >
              {label}
            </label>
          )}
          {helperText && (
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}
            >
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


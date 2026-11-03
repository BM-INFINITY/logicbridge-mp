import React from 'react';

/**
 * SwitchField — Accessible, interactive toggle switch component.
 * Supports both `value` and `checked` props for robust integration across sidebars.
 */
export default function SwitchField({ label, value, checked, onChange, helperText, disabled = false, style = {} }) {
  const isChecked = (value !== undefined ? value : checked) === true || (value !== undefined ? value : checked) === 'true';

  const handleToggle = () => {
    if (disabled) return;
    onChange(!isChecked);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className="form-group" style={{ marginBottom: 8, width: '100%', minWidth: 0, ...style }}>
      <div
        className="switch-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          minWidth: 0,
        }}
      >
        {label && (
          <span
            className="form-label"
            style={{
              cursor: disabled ? 'default' : 'pointer',
              margin: 0,
              userSelect: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: 0,
              flex: 1,
            }}
            onClick={handleToggle}
          >
            {label}
          </span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          aria-label={typeof label === 'string' ? label : 'Toggle switch'}
          className={`switch-track ${isChecked ? 'checked' : ''}`}
          data-checked={isChecked ? 'true' : 'false'}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span className="switch-thumb" />
        </button>
      </div>
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

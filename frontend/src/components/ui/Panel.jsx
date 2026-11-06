import React from 'react';
import renderIcon from './renderIcon';

/**
 * Standard Panel component for configuration sidebars and secondary view containers.
 */
export default function Panel({
  children,
  title,
  action,
  icon,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className={`panel ${className}`.trim()}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      {(title || action || icon) && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {icon && <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>{renderIcon(icon, { size: 16 })}</span>}
            {title && (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </span>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}


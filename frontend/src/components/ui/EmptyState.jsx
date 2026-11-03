import React from 'react';

/**
 * Standard EmptyState component for lists, tables, workflows, logs, and searches.
 */
export default function EmptyState({
  icon,
  title = 'No items found',
  description,
  action,
  secondaryAction,
  compact = false,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`empty-state ${className}`.trim()}
      style={{
        padding: compact ? '32px 16px' : '64px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
        ...style,
      }}
    >
      {icon && (
        <div
          className="empty-icon"
          style={{
            width: compact ? 48 : 64,
            height: compact ? 48 : 64,
            marginBottom: 4,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {title && (
        <h4
          style={{
            margin: 0,
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: compact ? '1rem' : '1.2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h4>
      )}

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: compact ? '0.8rem' : '0.875rem',
            color: 'var(--text-secondary)',
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 8,
          }}
        >
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}


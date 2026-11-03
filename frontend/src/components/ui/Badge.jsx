import React from 'react';

/**
 * Standard Badge component for status tags, pill indicators, and counters.
 */
export default function Badge({
  children,
  variant = 'primary', // 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline'
  size = 'sm',        // 'sm' | 'md'
  dot = false,
  icon,
  className = '',
  style = {},
  ...props
}) {
  const getVariantClass = () => {
    switch (variant) {
      case 'success': return 'badge-success';
      case 'danger': return 'badge-danger';
      case 'warning': return 'badge-warning';
      case 'info': return 'badge-info';
      case 'muted': return 'badge-muted';
      case 'outline': return 'badge-outline';
      case 'primary':
      default: return 'badge-primary';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'success': return 'var(--color-success, #22c55e)';
      case 'danger': return 'var(--color-danger, #ef4444)';
      case 'warning': return 'var(--color-warning, #f59e0b)';
      case 'info': return 'var(--color-info, #0ea5e9)';
      case 'muted': return 'var(--text-muted)';
      case 'outline': return 'var(--text-secondary)';
      case 'primary':
      default: return 'var(--accent-primary)';
    }
  };

  return (
    <span
      className={`badge ${getVariantClass()} ${className}`.trim()}
      style={{
        padding: size === 'md' ? '4px 12px' : '2px 8px',
        fontSize: size === 'md' ? '0.8rem' : '0.72rem',
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          className="badge-dot"
          style={{ background: getDotColor() }}
          aria-hidden="true"
        />
      )}
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}


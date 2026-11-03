import React from 'react';

/**
 * Standard IconButton component with accessible labeling and square dimensions.
 */
export default function IconButton({
  icon,
  children,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg'
  variant = 'ghost', // 'ghost' | 'secondary' | 'primary' | 'danger'
  loading = false,
  disabled = false,
  onClick,
  title,
  ariaLabel,
  className = '',
  style = {},
  type = 'button',
  ...props
}) {
  const iconContent = icon || children;
  const label = ariaLabel || title;

  const getSizeClass = () => {
    switch (size) {
      case 'xs': return 'btn-icon-xs';
      case 'sm': return 'btn-icon-sm';
      case 'lg': return 'btn-icon-lg';
      default: return '';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--accent-gradient)',
          color: '#ffffff',
          border: 'none',
        };
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--color-danger, #ef4444)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border)',
        };
      case 'ghost':
      default:
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          borderColor: 'transparent',
        };
    }
  };

  return (
    <button
      type={type}
      className={`btn-icon ${getSizeClass()} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      aria-label={label}
      aria-busy={loading ? 'true' : undefined}
      style={{
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          className="spinner"
          style={{
            width: size === 'xs' ? 12 : 14,
            height: size === 'xs' ? 12 : 14,
            borderWidth: 2,
          }}
          aria-hidden="true"
        />
      ) : (
        iconContent
      )}
    </button>
  );
}


import React from 'react';

/**
 * Standard Button component supporting design system tokens,
 * multiple variants, sizes, loading spinners, and icons.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size = 'md',        // 'xs' | 'sm' | 'md' | 'lg'
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  className = '',
  style = {},
  title,
  ariaLabel,
  ...props
}) {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary': return 'btn-primary';
      case 'secondary': return 'btn-secondary';
      case 'ghost': return 'btn-ghost';
      case 'danger': return 'btn-danger';
      case 'outline': return 'btn-outline';
      default: return 'btn-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'xs': return 'btn-xs';
      case 'sm': return 'btn-sm';
      case 'lg': return 'btn-lg';
      default: return '';
    }
  };

  const buttonStyle = {
    ...(fullWidth ? { width: '100%' } : {}),
    ...style,
  };

  return (
    <button
      type={type}
      className={`btn ${getVariantClass()} ${getSizeClass()} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      style={buttonStyle}
      title={title}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? (
        <span
          className="spinner"
          style={{
            width: size === 'xs' ? 12 : size === 'sm' ? 14 : 16,
            height: size === 'xs' ? 12 : size === 'sm' ? 14 : 16,
            borderWidth: 2,
          }}
          aria-hidden="true"
        />
      ) : (
        icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{iconRight}</span>
      )}
    </button>
  );
}


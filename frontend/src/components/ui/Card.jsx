import React from 'react';

/**
 * Standard Card component with consistent border, elevation, and slots.
 */
export default function Card({
  children,
  variant = 'default', // 'default' | 'elevated' | 'glass' | 'outline'
  padding = 'md',      // 'none' | 'sm' | 'md' | 'lg'
  hoverable = false,
  title,
  subtitle,
  action,
  header,
  footer,
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const getPadding = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return '12px 16px';
      case 'lg': return '28px 32px';
      case 'md':
      default: return '20px 24px';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        };
      case 'glass':
        return {
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border)',
        };
      case 'outline':
        return {
          background: 'transparent',
          border: '1px solid var(--border)',
        };
      case 'default':
      default:
        return {
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        };
    }
  };

  const cardStyle = {
    borderRadius: 'var(--radius-lg)',
    padding: getPadding(),
    transition: 'all var(--transition)',
    cursor: onClick || hoverable ? 'pointer' : 'default',
    ...getVariantStyles(),
    ...style,
  };

  return (
    <div
      className={`card ${hoverable ? 'card-hover' : ''} ${className}`.trim()}
      style={cardStyle}
      onClick={onClick}
      {...props}
    >
      {(header || title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: children ? 16 : 0,
            paddingBottom: children ? 12 : 0,
            borderBottom: children ? '1px solid var(--border-subtle, var(--border))' : 'none',
          }}
        >
          {header || (
            <div>
              {title && (
                <h4
                  style={{
                    margin: 0,
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {title}
                </h4>
              )}
              {subtitle && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {action && <div>{action}</div>}
        </div>
      )}

      {children}

      {footer && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle, var(--border))',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}


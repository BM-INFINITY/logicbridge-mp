import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import renderIcon from './renderIcon';

/**
 * Standard Alert component for user feedback, validation notices, and execution alerts.
 */
export default function Alert({
  variant = 'info', // 'success' | 'warning' | 'danger' | 'error' | 'info'
  title,
  message,
  children,
  icon,
  dismissible = false,
  onDismiss,
  action,
  className = '',
  style = {},
  ...props
}) {
  const normalizedVariant = variant === 'danger' ? 'error' : variant;

  const getDefaultIcon = () => {
    switch (normalizedVariant) {
      case 'success': return <CheckCircle2 size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      case 'error': return <AlertCircle size={18} />;
      case 'info':
      default: return <Info size={18} />;
    }
  };

  const getVariantClass = () => {
    switch (normalizedVariant) {
      case 'success': return 'alert-success';
      case 'warning': return 'alert-warning';
      case 'error': return 'alert-danger';
      case 'info':
      default: return 'alert-info';
    }
  };

  const iconElement = icon !== undefined ? icon : getDefaultIcon();

  return (
    <div
      role={normalizedVariant === 'error' ? 'alert' : 'status'}
      className={`alert ${getVariantClass()} ${className}`.trim()}
      style={style}
      {...props}
    >
      {iconElement && <div className="alert-icon">{renderIcon(iconElement, { size: 18 })}</div>}
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {message && <div>{message}</div>}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      {dismissible && (
        <button
          type="button"
          className="alert-close"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}


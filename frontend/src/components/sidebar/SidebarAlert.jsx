import React from 'react';
import Alert from '../ui/Alert';

/**
 * Standardized SidebarAlert component for configuration prerequisites, warnings,
 * and schema error callouts inside node configuration panels.
 */
export default function SidebarAlert({
  variant = 'warning',
  title,
  message,
  children,
  icon,
  dismissible = false,
  onDismiss,
  style = {},
  className = '',
}) {
  return (
    <Alert
      variant={variant}
      title={title}
      message={message}
      icon={icon}
      dismissible={dismissible}
      onDismiss={onDismiss}
      className={className}
      style={{
        padding: '8px 12px',
        fontSize: '0.78rem',
        borderRadius: 'var(--radius-sm, 8px)',
        ...style,
      }}
    >
      {children}
    </Alert>
  );
}


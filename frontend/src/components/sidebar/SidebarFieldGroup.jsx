import React from 'react';
import FieldGroup from '../ui/FieldGroup';

/**
 * Standardized SidebarFieldGroup wrapper for fields placed inside configuration sidebars.
 * Directly integrates with LogicBridge design tokens and standard variable insertion controls.
 */
export default function SidebarFieldGroup({
  label,
  required,
  helperText,
  error,
  action,
  children,
  htmlFor,
  style = {},
  className = '',
}) {
  return (
    <FieldGroup
      label={label}
      required={required}
      helperText={helperText}
      error={error}
      action={action}
      htmlFor={htmlFor}
      style={style}
      className={className}
    >
      {children}
    </FieldGroup>
  );
}


import React from 'react';

/**
 * Standard StatusIndicator component displaying a status dot and label.
 */
export default function StatusIndicator({
  status = 'active', // 'active' | 'draft' | 'running' | 'completed' | 'failed' | 'paused' | 'waiting'
  label,
  size = 'sm', // 'sm' | 'md'
  pulse = false,
  className = '',
  style = {},
  ...props
}) {
  const normalizedStatus = (status || '').toLowerCase();

  const getStatusConfig = () => {
    switch (normalizedStatus) {
      case 'active':
      case 'completed':
      case 'success':
        return {
          color: 'var(--color-success, #22c55e)',
          label: 'Active',
          pulse: false,
        };
      case 'running':
      case 'in_progress':
      case 'executing':
        return {
          color: 'var(--color-info, #0ea5e9)',
          label: 'Running',
          pulse: true,
        };
      case 'failed':
      case 'error':
        return {
          color: 'var(--color-danger, #ef4444)',
          label: 'Failed',
          pulse: false,
        };
      case 'warning':
      case 'waiting':
      case 'approval_required':
        return {
          color: 'var(--color-warning, #f59e0b)',
          label: 'Waiting',
          pulse: true,
        };
      case 'paused':
        return {
          color: 'var(--accent-primary, #6c63ff)',
          label: 'Paused',
          pulse: false,
        };
      case 'draft':
      case 'inactive':
      default:
        return {
          color: 'var(--text-muted, #64748b)',
          label: 'Draft',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();
  const displayLabel = label !== undefined ? label : config.label;
  const shouldPulse = pulse || config.pulse;
  const dotSize = size === 'md' ? 8 : 6;

  return (
    <span
      className={`status-indicator ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: size === 'md' ? '0.85rem' : '0.78rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: config.color,
          boxShadow: `0 0 6px ${config.color}`,
          display: 'inline-block',
          flexShrink: 0,
          animation: shouldPulse ? 'pulse-glow 2s ease infinite' : 'none',
        }}
        aria-hidden="true"
      />
      {displayLabel && <span>{displayLabel}</span>}
    </span>
  );
}


import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

/**
 * Standard ErrorState component for failed page loads, data fetch failures,
 * and broken component states with built-in Retry action.
 */
export default function ErrorState({
  title = 'Unable to load content',
  message = 'Something went wrong while communicating with the server. Please check your connection and try again.',
  requestId,
  onRetry,
  retryLabel = 'Try Again',
  secondaryAction,
  compact = false,
  className = '',
  style = {},
}) {
  return (
    <div
      role="alert"
      className={`error-state ${className}`.trim()}
      style={{
        padding: compact ? '28px 16px' : '56px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.04)',
        border: '1px solid rgba(239, 68, 68, 0.18)',
        borderRadius: 'var(--radius-lg, 12px)',
        margin: compact ? '12px 0' : '24px 0',
        gap: 12,
        ...style,
      }}
    >
      <div
        style={{
          width: compact ? 40 : 54,
          height: compact ? 40 : 54,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--accent-danger, #ef4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <AlertTriangle size={compact ? 20 : 28} />
      </div>

      <div style={{ maxWidth: 440 }}>
        <h4
          style={{
            margin: '0 0 6px 0',
            fontWeight: 700,
            fontSize: compact ? '0.95rem' : '1.1rem',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: compact ? '0.78rem' : '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        {requestId && (
          <div
            style={{
              marginTop: 6,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
          >
            Reference: {requestId}
          </div>
        )}
      </div>

      {(onRetry || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {onRetry && (
            <Button
              size={compact ? 'sm' : 'md'}
              variant="primary"
              onClick={onRetry}
            >
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              {retryLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

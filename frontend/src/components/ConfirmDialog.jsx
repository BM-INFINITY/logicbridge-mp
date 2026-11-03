import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, X, Trash2 } from 'lucide-react';

/**
 * ConfirmDialog — Accessible, theme-consistent replacement for window.confirm().
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onClose,
  loading = false,
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus the cancel or confirm button for accessibility
    setTimeout(() => confirmBtnRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 99999 }}
      onClick={() => { if (!loading) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="modal"
        style={{
          maxWidth: 440,
          padding: 24,
          background: 'var(--bg-elevated)',
          border: isDanger ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: isDanger
                ? 'rgba(239, 68, 68, 0.15)'
                : isWarning
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(108, 99, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: isDanger
                ? 'var(--accent-danger)'
                : isWarning
                ? 'var(--accent-warning)'
                : 'var(--accent-primary)',
            }}
          >
            {isDanger ? <Trash2 size={20} /> : isWarning ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
          </div>

          <div style={{ flex: 1 }}>
            <h3
              id="confirm-dialog-title"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 6px 0',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {message}
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


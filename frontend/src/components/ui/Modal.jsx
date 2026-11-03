import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

/**
 * Standard accessible Modal dialog component.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 500,
  closeOnBackdropClick = true,
  className = '',
  style = {},
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent body scrolling when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-dialog-title' : undefined}
    >
      <div
        ref={dialogRef}
        className={`modal-content ${className}`.trim()}
        style={{
          maxWidth,
          width: '100%',
          padding: 24,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          ...style,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || icon || onClose) && (
          <div
            className="modal-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {icon && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(108, 99, 255, 0.15)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                {title && (
                  <h3
                    id="modal-dialog-title"
                    className="modal-title"
                    style={{
                      margin: 0,
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {onClose && (
              <IconButton
                icon={<X size={16} />}
                size="sm"
                variant="ghost"
                onClick={onClose}
                title="Close modal"
                ariaLabel="Close modal"
              />
            )}
          </div>
        )}

        <div style={{ minWidth: 0 }}>{children}</div>

        {footer && (
          <div
            className="modal-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 20,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}


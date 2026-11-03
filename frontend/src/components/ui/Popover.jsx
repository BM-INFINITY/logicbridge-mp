import React, { useState, useRef, useEffect } from 'react';

/**
 * Standard Popover component for floating contextual menus and detail cards.
 */
export default function Popover({
  trigger,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
  placement = 'bottom-start', // 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  width,
  className = '',
  style = {},
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const containerRef = useRef(null);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const setOpen = (val) => {
    if (!isControlled) setInternalIsOpen(val);
    if (onOpenChange) onOpenChange(val);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (!isControlled) setInternalIsOpen(false);
        if (onOpenChange) onOpenChange(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!isControlled) setInternalIsOpen(false);
        if (onOpenChange) onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isControlled, onOpenChange]);

  const getPlacementStyles = () => {
    switch (placement) {
      case 'bottom-end':
        return { top: '100%', right: 0, marginTop: 6 };
      case 'top-start':
        return { bottom: '100%', left: 0, marginBottom: 6 };
      case 'top-end':
        return { bottom: '100%', right: 0, marginBottom: 6 };
      case 'bottom-start':
      default:
        return { top: '100%', left: 0, marginTop: 6 };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`popover-container ${className}`.trim()}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      {typeof trigger === 'function'
        ? trigger({ isOpen, toggle: () => setOpen(!isOpen) })
        : (
          <div onClick={() => setOpen(!isOpen)} style={{ cursor: 'pointer' }}>
            {trigger}
          </div>
        )}

      {isOpen && (
        <div
          role="dialog"
          style={{
            position: 'absolute',
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 12,
            minWidth: 200,
            width: width || 'max-content',
            ...getPlacementStyles(),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

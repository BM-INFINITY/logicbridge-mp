import React, { useState, useRef } from 'react';

/**
 * Standard accessible Tooltip component.
 */
export default function Tooltip({
  content,
  children,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  delay = 150,
  className = '',
  style = {},
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  if (!content) return children;

  const getPositionStyles = () => {
    switch (position) {
      case 'bottom':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6,
        };
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: 6,
        };
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 6,
        };
      case 'top':
      default:
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
        };
    }
  };

  return (
    <span
      className={`tooltip-wrapper ${className}`.trim()}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      aria-describedby={isVisible ? tooltipId.current : undefined}
    >
      {children}
      {isVisible && (
        <span
          id={tooltipId.current}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 1000,
            padding: '5px 9px',
            fontSize: '0.74rem',
            lineHeight: 1.3,
            fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xs, 4px)',
            boxShadow: 'var(--shadow-md)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            ...getPositionStyles(),
            ...style,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}


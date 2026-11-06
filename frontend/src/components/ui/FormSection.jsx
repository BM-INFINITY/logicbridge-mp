import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import renderIcon from './renderIcon';

/**
 * Standard FormSection component for grouping configuration fields into
 * visual or collapsible sections.
 */
export default function FormSection({
  title,
  description,
  icon,
  badge,
  action,
  collapsible = false,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  className = '',
  style = {},
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (!collapsible) return;
    if (onToggle) {
      onToggle(!isOpen);
    } else {
      setInternalIsOpen(!isOpen);
    }
  };

  return (
    <div
      className={`form-section ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      {(title || icon || action) && (
        <div
          onClick={collapsible ? handleToggle : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            cursor: collapsible ? 'pointer' : 'default',
            padding: '4px 0',
            userSelect: collapsible ? 'none' : 'auto',
          }}
          role={collapsible ? 'button' : undefined}
          aria-expanded={collapsible ? isOpen : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={collapsible ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          } : undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            {collapsible && (
              <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            {icon && (
              <span style={{ color: 'var(--accent-primary)', display: 'flex', flexShrink: 0 }}>
                {renderIcon(icon, { size: 15 })}
              </span>
            )}
            {title && (
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </span>
            )}
            {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
          </div>

          {action && (
            <div
              style={{ flexShrink: 0 }}
              onClick={(e) => collapsible && e.stopPropagation()}
            >
              {action}
            </div>
          )}
        </div>
      )}

      {description && (!collapsible || isOpen) && (
        <p
          style={{
            margin: '-4px 0 2px 0',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      )}

      {(!collapsible || isOpen) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
            minWidth: 0,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}


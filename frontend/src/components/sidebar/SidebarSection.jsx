import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Standardized SidebarSection component used across all node configuration panels.
 * Provides uniform section headers, badges, collapsible actions, and bottom dividers.
 */
export default function SidebarSection({
  title,
  icon,
  badge,
  action,
  collapsible = false,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  style = {},
  className = '',
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
      className={`sidebar-section ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-subtle, var(--border))',
        minWidth: 0,
        width: '100%',
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
            userSelect: collapsible ? 'none' : 'auto',
            paddingTop: 2,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            {collapsible && (
              <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            {icon && (
              <span style={{ color: 'var(--accent-primary)', display: 'flex', flexShrink: 0 }}>
                {icon}
              </span>
            )}
            {title && (
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
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


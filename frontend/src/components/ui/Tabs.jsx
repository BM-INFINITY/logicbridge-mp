import React from 'react';

/**
 * Standard Tabs component with accessible ARIA semantics and keyboard navigation.
 */
export default function Tabs({
  tabs = [], // [{ id, label, icon, badge, disabled }]
  activeTab,
  onChange,
  variant = 'underline', // 'underline' | 'pills' | 'segmented'
  size = 'md',          // 'sm' | 'md'
  fullWidth = false,
  className = '',
  style = {},
}) {
  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      if (!tabs[nextIndex].disabled) onChange(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      if (!tabs[prevIndex].disabled) onChange(tabs[prevIndex].id);
    }
  };

  const getContainerStyles = () => {
    switch (variant) {
      case 'segmented':
        return {
          background: 'var(--bg-surface)',
          padding: 3,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          gap: 4,
          border: '1px solid var(--border)',
        };
      case 'pills':
        return {
          display: 'flex',
          gap: 6,
        };
      case 'underline':
      default:
        return {
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          gap: 2,
        };
    }
  };

  const getTabStyles = (isActive, disabled) => {
    const isSm = size === 'sm';
    const padding = isSm ? '6px 10px' : '10px 16px';
    const fontSize = isSm ? '0.78rem' : '0.85rem';

    if (variant === 'segmented') {
      return {
        flex: fullWidth ? 1 : 'none',
        padding: isSm ? '4px 8px' : '6px 12px',
        fontSize,
        borderRadius: 'var(--radius-xs)',
        border: 'none',
        background: isActive ? 'var(--bg-card)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: isActive ? 600 : 500,
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all var(--transition)',
        whiteSpace: 'nowrap',
      };
    }

    if (variant === 'pills') {
      return {
        flex: fullWidth ? 1 : 'none',
        padding,
        fontSize,
        borderRadius: 'var(--radius-full)',
        border: '1px solid',
        borderColor: isActive ? 'var(--accent-primary)' : 'transparent',
        background: isActive ? 'rgba(108, 99, 255, 0.15)' : 'var(--bg-elevated)',
        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all var(--transition)',
        whiteSpace: 'nowrap',
      };
    }

    // Default: underline
    return {
      flex: fullWidth ? 1 : 'none',
      padding,
      fontSize,
      border: 'none',
      background: 'transparent',
      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
      fontWeight: isActive ? 600 : 500,
      borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      transition: 'all var(--transition)',
      whiteSpace: 'nowrap',
      marginBottom: -1,
    };
  };

  return (
    <div
      role="tablist"
      className={`tabs-container ${className}`.trim()}
      style={{
        ...getContainerStyles(),
        overflowX: 'auto',
        ...style,
      }}
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={tab.disabled ? 'true' : undefined}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={getTabStyles(isActive, tab.disabled)}
            tabIndex={isActive ? 0 : -1}
          >
            {tab.icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}


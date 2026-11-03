import React, { useState, useRef, useEffect } from 'react';

/**
 * Standard accessible Dropdown component for action menus, context menus, and select triggers.
 */
export default function Dropdown({
  trigger,
  items = [], // [{ id, label, icon, danger, disabled, onClick }]
  align = 'right', // 'left' | 'right'
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (item) => {
    if (item.disabled) return;
    setIsOpen(false);
    if (item.onClick) item.onClick();
  };

  return (
    <div
      ref={containerRef}
      className={`dropdown ${className}`.trim()}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      <div onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        {typeof trigger === 'function' ? trigger({ isOpen }) : trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            [align === 'right' ? 'right' : 'left']: 0,
            marginTop: 6,
            minWidth: 160,
            zIndex: 1000,
          }}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="dropdown-divider" role="separator" />;
            }

            return (
              <button
                key={item.id || idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
                onClick={() => handleItemClick(item)}
                style={{
                  opacity: item.disabled ? 0.5 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


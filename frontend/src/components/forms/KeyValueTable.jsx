import React from 'react';
import { Trash2, Braces } from 'lucide-react';

export default function KeyValueTable({
  title,
  items = [],
  onAdd,
  onUpdate,
  onRemove,
  onInsertValueVariable,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  helperText,
}) {
  return (
    <div className="form-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        {title && <label className="form-label" style={{ margin: 0 }}>{title}</label>}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Add Row
          </button>
        )}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ fontSize: '0.75rem', padding: '5px', flex: 1 }}
            placeholder={keyPlaceholder}
            value={item.key || ''}
            onChange={(e) => onUpdate(i, 'key', e.target.value)}
          />
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '5px', paddingRight: onInsertValueVariable ? '24px' : '5px', width: '100%' }}
              placeholder={valuePlaceholder}
              value={item.value || ''}
              onChange={(e) => onUpdate(i, 'value', e.target.value)}
            />
            {onInsertValueVariable && (
              <button
                type="button"
                onClick={() => onInsertValueVariable(i)}
                style={{
                  position: 'absolute',
                  right: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Insert Variable"
              >
                <Braces size={12} />
              </button>
            )}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 2 }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

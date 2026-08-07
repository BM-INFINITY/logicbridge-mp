import React from 'react';
import { Trash2 } from 'lucide-react';

export default function KeyValueTable({
  title,
  items = [],
  onAdd,
  onUpdate,
  onRemove,
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
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            className="form-input"
            style={{ fontSize: '0.75rem', padding: '5px' }}
            placeholder={keyPlaceholder}
            value={item.key || ''}
            onChange={(e) => onUpdate(i, 'key', e.target.value)}
          />
          <input
            className="form-input"
            style={{ fontSize: '0.75rem', padding: '5px' }}
            placeholder={valuePlaceholder}
            value={item.value || ''}
            onChange={(e) => onUpdate(i, 'value', e.target.value)}
          />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
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

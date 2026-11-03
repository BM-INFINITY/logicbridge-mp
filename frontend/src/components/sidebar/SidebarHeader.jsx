import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { getNodeIcon } from '../../constants/Icons';

export default function SidebarHeader({ title, nodeType, color, onDelete, onClose }) {
  const NodeIcon = getNodeIcon(nodeType);

  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--bg-card)',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${color}20`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NodeIcon size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.92rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={title}
          >
            {title}
          </h3>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onDelete && (
          <button
            className="btn btn-sm btn-danger"
            style={{ padding: '4px 8px', height: 28 }}
            onClick={onDelete}
            title="Delete step"
            aria-label="Delete node"
          >
            <Trash2 size={13} />
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-xs, 4px)',
          }}
          aria-label="Close panel"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

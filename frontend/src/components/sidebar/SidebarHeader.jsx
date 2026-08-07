import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { getNodeIcon } from '../../constants/Icons';

export default function SidebarHeader({ title, nodeType, color, onDelete, onClose }) {
  const NodeIcon = getNodeIcon(nodeType);

  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{title}</h3>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onDelete && (
          <button
            className="btn btn-sm btn-danger"
            style={{ padding: '4px 8px' }}
            onClick={onDelete}
            title="Delete step"
            aria-label="Delete node"
          >
            <Trash2 size={13} />
          </button>
        )}
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { NODE_DEFS } from '../../../data/templates';
import { getNodeIcon } from '../../../constants/Icons';

export default function NodePalette() {
  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="node-palette" style={{ width: 210, zIndex: 10, overflowY: 'auto' }}>
      <div style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
        Node Palette
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Drag onto canvas →
      </div>
      {['trigger', 'action', 'logic'].map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div className="palette-section-title">
            {cat === 'trigger' ? 'Triggers' : cat === 'action' ? 'Actions' : 'Logic'}
          </div>
          {Object.entries(NODE_DEFS)
            .filter(([, d]) => d.category === cat)
            .map(([type, def]) => (
              <div
                key={type}
                className="palette-node"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
              >
                <div className="palette-node-icon" style={{ background: `${def.color}20`, color: def.color }}>
                  {React.createElement(getNodeIcon(type), { size: 13 })}
                </div>
                <span style={{ fontSize: '0.78rem' }}>{def.label}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

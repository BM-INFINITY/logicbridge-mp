import React, { useState } from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { X } from 'lucide-react';
import useCanvasStore from '../../../store/canvasStore';
import { BranchColors } from '../../../constants';

const HANDLE_COLOR_MAP = {
  true: BranchColors.TRUE || '#10b981',
  false: BranchColors.FALSE || '#ef4444',
  loop: BranchColors.LOOP || '#06b6d4',
  done: BranchColors.DONE || '#10b981',
  approved: '#10b981',
  rejected: '#ef4444',
  timeout: '#f59e0b',
  resumed: '#0ea5e9',
  default: BranchColors.SWITCH_DEFAULT || '#64748b',
};

const HANDLE_LABEL_MAP = {
  true: 'True',
  false: 'False',
  loop: 'Loop',
  done: 'Done',
  approved: 'Approved',
  rejected: 'Rejected',
  timeout: 'Timeout',
  resumed: 'Resumed',
  default: 'Default',
};

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  sourceHandleId,
  data,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const deleteEdge = useCanvasStore((state) => state.deleteEdge);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleId = sourceHandleId || data?.sourceHandle;
  const isBranchHandle = handleId && (HANDLE_COLOR_MAP[handleId] || handleId.startsWith('case_'));

  const edgeColor = selected
    ? 'var(--accent-primary)'
    : handleId && HANDLE_COLOR_MAP[handleId]
    ? HANDLE_COLOR_MAP[handleId]
    : style.stroke || 'var(--accent-primary)';

  const labelText = data?.label || (handleId ? (HANDLE_LABEL_MAP[handleId] || (handleId.startsWith('case_') ? handleId.replace('_', ' ').toUpperCase() : handleId)) : null);

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  return (
    <g
      className="custom-edge-group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible wider hit area for easy hover / selection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
      />

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: selected ? 2.5 : isHovered ? 2.2 : 1.8,
          strokeDasharray: data?.animated ? '6, 4' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s',
          filter: selected ? 'drop-shadow(0 0 4px var(--accent-primary))' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 10,
          }}
          className="nodrag nopan"
        >
          {/* Branch Pill Label */}
          {labelText && (
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: 10,
                background: 'var(--bg-elevated)',
                color: isBranchHandle && HANDLE_COLOR_MAP[handleId] ? HANDLE_COLOR_MAP[handleId] : 'var(--text-secondary)',
                border: `1px solid ${isBranchHandle && HANDLE_COLOR_MAP[handleId] ? `${HANDLE_COLOR_MAP[handleId]}88` : 'var(--border)'}`,
                boxShadow: 'var(--shadow-sm)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              {labelText}
            </div>
          )}

          {/* Quick Delete Edge Button */}
          {(isHovered || selected) && (
            <button
              onClick={handleDelete}
              title="Delete Connection"
              aria-label="Delete Connection"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}


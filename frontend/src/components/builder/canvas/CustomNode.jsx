import React, { useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  CheckCircle2, XCircle, AlertCircle, AlertTriangle,
  UserCheck, Clock,
} from 'lucide-react';
import { NODE_DEFS } from '../../../data/templates';
import { getNodeIcon } from '../../../constants/Icons';
import { BranchColors } from '../../../constants';
import NodeValidator from '../../../validators/NodeValidator';

const CATEGORY_COLORS = {
  trigger: '#10b981',
  action: '#6366f1',
  logic: '#f59e0b',
  ai: '#8b5cf6',
};

export default function CustomNode({ data, selected, type, isConnectable = true }) {
  const def = NODE_DEFS[type] || {
    label: type,
    icon: 'Settings',
    color: '#6c63ff',
    category: 'action',
    description: '',
  };

  const NodeIcon = getNodeIcon(type);
  const isFirst = def.category === 'trigger';
  const isCondition = type === 'logic-condition' || type === 'action-condition';
  const isLoop = type === 'action-loop';
  const isSwitch = type === 'action-switch' || type === 'logic-switch';
  const isApproval = type === 'action-approval';
  const isWait = type === 'action-wait' || type === 'action-delay';

  const execStatus = data?._execStatus;
  const isActive = data?._isActive;
  const isPausedState = execStatus === 'waiting' || execStatus === 'waiting_approval' || execStatus === 'paused';

  // Validation Check for Missing / Invalid Configuration
  const validation = useMemo(() => {
    return NodeValidator.validateNode({ type, data });
  }, [type, data]);

  const categoryColor = CATEGORY_COLORS[def.category] || def.color || '#6c63ff';

  // Border & Glow State Calculation
  const borderStyle = useMemo(() => {
    if (isActive) return '#22d3ee';
    if (execStatus === 'success') return BranchColors.TRUE;
    if (execStatus === 'failed') return BranchColors.FALSE;
    if (execStatus === 'skipped') return BranchColors.SKIPPED;
    if (isPausedState) return '#f59e0b';
    if (selected) return 'var(--accent-primary)';
    if (!validation.valid) return 'var(--warning-border)';
    return 'var(--border)';
  }, [isActive, execStatus, isPausedState, selected, validation.valid]);

  const shadowStyle = useMemo(() => {
    if (isActive) return '0 0 24px rgba(34,211,238,0.75)';
    if (execStatus === 'success') return '0 0 16px rgba(34,197,94,0.35)';
    if (execStatus === 'failed') return '0 0 16px rgba(239,68,68,0.35)';
    if (isPausedState) return '0 0 16px rgba(245,158,11,0.45)';
    if (selected) return '0 0 0 2px var(--accent-primary), 0 0 20px rgba(108, 99, 255, 0.4)';
    if (!validation.valid) return '0 0 12px rgba(245, 158, 11, 0.25)';
    return 'var(--shadow-sm)';
  }, [isActive, execStatus, isPausedState, selected, validation.valid]);

  const handleBaseStyle = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid var(--bg-base)',
    transition: 'transform 0.15s ease, width 0.15s ease, height 0.15s ease',
    cursor: 'crosshair',
    zIndex: 10,
  };

  return (
    <div
      className={`flow-node node-${def.category}`}
      style={{
        width: 200,
        minWidth: 200,
        maxWidth: 200,
        borderRadius: 10,
        border: `1.5px solid ${borderStyle}`,
        background: 'var(--bg-surface)',
        boxShadow: shadowStyle,
        opacity: execStatus === 'skipped' ? 0.45 : 1,
        transform: isActive ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.18s ease-in-out',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Category Top Indicator Bar */}
      <div
        style={{
          height: 3,
          width: '100%',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          background: `linear-gradient(90deg, ${categoryColor}, ${categoryColor}88)`,
        }}
      />

      {/* Target Handle (Left) - omitted for trigger nodes */}
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="custom-flow-handle"
          style={{
            ...handleBaseStyle,
            left: -6,
            background: categoryColor,
          }}
        />
      )}

      {/* Node Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 6px 10px',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: `${def.color}18`,
            color: def.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NodeIcon size={14} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={data?.label || def.label}
          >
            {data?.label || def.label}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: categoryColor,
              textTransform: 'uppercase',
            }}
          >
            {def.category === 'ai' ? 'AI / LLM' : def.category}
          </div>
        </div>

        {/* Right Header Status / Warning Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Missing Configuration Warning Badge */}
          {!validation.valid && (
            <span
              title={`Configuration incomplete: ${validation.error}`}
              aria-label={`Validation warning: ${validation.error}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--warning)',
                cursor: 'help',
              }}
            >
              <AlertTriangle size={13} strokeWidth={2.2} />
            </span>
          )}

          {/* Execution Status Badge */}
          {execStatus && (
            <div>
              {execStatus === 'success' && <CheckCircle2 size={13} color={BranchColors.TRUE} />}
              {execStatus === 'failed' && <XCircle size={13} color={BranchColors.FALSE} />}
              {execStatus === 'skipped' && <AlertCircle size={13} color={BranchColors.SKIPPED} />}
              {(execStatus === 'waiting' || execStatus === 'waiting_approval') && (
                <UserCheck size={13} color="#f59e0b" title="Waiting for Approval" />
              )}
              {execStatus === 'paused' && <Clock size={13} color="#0ea5e9" title="Paused / Waiting" />}
              {execStatus === 'running' && (
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Node Body Details */}
      <div style={{ padding: '6px 10px 8px 10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {data?.url ? (
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
            title={data.url}
          >
            {data.method ? `${data.method} ` : ''}{data.url}
          </div>
        ) : data?.operation ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>
              {data.operation}
            </span>
            {data.table && <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{data.table}</span>}
          </div>
        ) : data?.cron ? (
          <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
            cron: {data.cron}
          </div>
        ) : data?.prompt ? (
          <div
            style={{
              fontSize: '0.68rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-secondary)',
            }}
            title={data.prompt}
          >
            {data.prompt}
          </div>
        ) : data?.message ? (
          <div
            style={{
              fontSize: '0.68rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={data.message}
          >
            {data.message}
          </div>
        ) : (
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {def.description || 'Configurable workflow step'}
          </div>
        )}

        {/* Iteration Progress for Loop Nodes */}
        {data?._iterationProgress && (
          <div style={{ fontSize: '0.68rem', color: '#06b6d4', marginTop: 3, fontWeight: 600 }}>
            {data._iterationProgress}
          </div>
        )}
      </div>

      {/* ─── Handles Configuration ────────────────────────────────────────── */}
      {isCondition ? (
        <>
          {/* True Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '32%', right: -6, background: BranchColors.TRUE }}
          />
          <div
            style={{
              position: 'absolute',
              right: -36,
              top: '22%',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: BranchColors.TRUE,
            }}
          >
            TRUE
          </div>

          {/* False Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '70%', right: -6, background: BranchColors.FALSE }}
          />
          <div
            style={{
              position: 'absolute',
              right: -40,
              top: '62%',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: BranchColors.FALSE,
            }}
          >
            FALSE
          </div>
        </>
      ) : isLoop ? (
        <>
          {/* Loop Body Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="loop"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '32%', right: -6, background: BranchColors.LOOP || '#06b6d4' }}
          />
          <div
            style={{
              position: 'absolute',
              right: -36,
              top: '22%',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: BranchColors.LOOP || '#06b6d4',
            }}
          >
            LOOP
          </div>

          {/* Loop Done Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="done"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '70%', right: -6, background: BranchColors.DONE || '#10b981' }}
          />
          <div
            style={{
              position: 'absolute',
              right: -36,
              top: '62%',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: BranchColors.DONE || '#10b981',
            }}
          >
            DONE
          </div>
        </>
      ) : isSwitch ? (
        <>
          {(() => {
            const switchCases = Array.isArray(data?.cases) && data.cases.length > 0
              ? data.cases
              : [{ id: 'case_1', label: 'Case 1' }];
            const totalOutputs = switchCases.length + 1; // cases + default
            const palette = BranchColors.SWITCH_CASES || ['#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#10b981', '#3b82f6'];

            return (
              <>
                {switchCases.map((c, i) => {
                  const handleId = c.id || `case_${i + 1}`;
                  const topPercent = Math.round(((i + 1) / (totalOutputs + 1)) * 100);
                  const color = palette[i % palette.length];
                  const label = (c.label || `Case ${i + 1}`).substring(0, 10).toUpperCase();

                  return (
                    <React.Fragment key={handleId}>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={handleId}
                        isConnectable={isConnectable}
                        className="custom-flow-handle"
                        style={{ ...handleBaseStyle, top: `${topPercent}%`, right: -6, background: color }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: -48,
                          top: `calc(${topPercent}% - 6px)`,
                          fontSize: '0.60rem',
                          fontWeight: 700,
                          color,
                          whiteSpace: 'nowrap',
                          maxWidth: 50,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={c.label || handleId}
                      >
                        {label}
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Default Fallback Handle */}
                {(() => {
                  const defaultTop = Math.round((totalOutputs / (totalOutputs + 1)) * 100);
                  const defaultColor = BranchColors.SWITCH_DEFAULT || '#64748b';
                  const defaultId = data?.defaultHandle || 'default';
                  return (
                    <React.Fragment key="default">
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={defaultId}
                        isConnectable={isConnectable}
                        className="custom-flow-handle"
                        style={{ ...handleBaseStyle, top: `${defaultTop}%`, right: -6, background: defaultColor }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: -48,
                          top: `calc(${defaultTop}% - 6px)`,
                          fontSize: '0.60rem',
                          fontWeight: 700,
                          color: defaultColor,
                        }}
                      >
                        DEFAULT
                      </div>
                    </React.Fragment>
                  );
                })()}
              </>
            );
          })()}
        </>
      ) : isApproval ? (
        <>
          {/* Approved Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="approved"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '25%', right: -6, background: '#10b981' }}
          />
          <div style={{ position: 'absolute', right: -58, top: '18%', fontSize: '0.60rem', fontWeight: 700, color: '#10b981' }}>
            APPROVED
          </div>

          {/* Rejected Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="rejected"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '55%', right: -6, background: '#ef4444' }}
          />
          <div style={{ position: 'absolute', right: -56, top: '48%', fontSize: '0.60rem', fontWeight: 700, color: '#ef4444' }}>
            REJECTED
          </div>

          {/* Timeout Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="timeout"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '85%', right: -6, background: '#f59e0b' }}
          />
          <div style={{ position: 'absolute', right: -52, top: '78%', fontSize: '0.60rem', fontWeight: 700, color: '#f59e0b' }}>
            TIMEOUT
          </div>
        </>
      ) : isWait ? (
        <>
          {/* Resumed Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="resumed"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '35%', right: -6, background: '#0ea5e9' }}
          />
          <div style={{ position: 'absolute', right: -52, top: '27%', fontSize: '0.60rem', fontWeight: 700, color: '#0ea5e9' }}>
            RESUMED
          </div>

          {/* Timeout Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="timeout"
            isConnectable={isConnectable}
            className="custom-flow-handle"
            style={{ ...handleBaseStyle, top: '75%', right: -6, background: '#f59e0b' }}
          />
          <div style={{ position: 'absolute', right: -50, top: '67%', fontSize: '0.60rem', fontWeight: 700, color: '#f59e0b' }}>
            TIMEOUT
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="custom-flow-handle"
          style={{ ...handleBaseStyle, right: -6, background: categoryColor }}
        />
      )}
    </div>
  );
}


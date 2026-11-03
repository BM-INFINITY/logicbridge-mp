import React, { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, X,
} from 'lucide-react';
import { NODE_DEFS } from '../../../data/templates';
import { getNodeIcon } from '../../../constants/Icons';
import NodeValidator from '../../../validators/NodeValidator';
import { IconButton, Badge } from '../../ui';

export default function ValidationDrawer({
  nodes = [],
  edges = [],
  isOpen,
  onClose,
  onNavigateToNode,
}) {
  const validation = useMemo(() => {
    return NodeValidator.validateWorkflow(nodes, edges);
  }, [nodes, edges]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Workflow Validation Drawer"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 340,
        maxHeight: 'calc(100% - 24px)',
        zIndex: 100,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: validation.valid ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: validation.valid ? 'var(--success)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {validation.valid ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
            Workflow Validation
          </span>
          <Badge
            variant={validation.valid ? 'success' : 'warning'}
            size="sm"
          >
            {validation.issues.length} {validation.issues.length === 1 ? 'issue' : 'issues'}
          </Badge>
        </div>

        <IconButton
          icon={<X size={14} />}
          onClick={onClose}
          aria-label="Close Validation Drawer"
          size="sm"
          variant="ghost"
        />
      </div>

      {/* Issues List or Valid State */}
      <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {validation.valid ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--success-bg)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              All Steps Validated
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: 260 }}>
              Every node in this workflow has valid required settings and is ready to execute.
            </div>
          </div>
        ) : (
          validation.issues.map((issue) => {
            const def = NODE_DEFS[issue.nodeType] || { label: issue.nodeType, color: '#6c63ff' };
            const NodeIcon = getNodeIcon(issue.nodeType);

            return (
              <div
                key={issue.nodeId}
                onClick={() => onNavigateToNode(issue.nodeId)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--warning)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--warning)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: `${def.color}20`,
                    color: def.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  <NodeIcon size={14} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      {issue.nodeLabel}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                      Fix <ChevronRight size={11} />
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--warning)', lineHeight: 1.35 }}>
                    {issue.error}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer Footer */}
      {!validation.valid && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Click any issue to highlight the node and configure its required parameters.
        </div>
      )}
    </div>
  );
}

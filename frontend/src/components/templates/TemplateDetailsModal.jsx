import React, { useEffect } from 'react';
import { getNodeIcon } from '../../constants/Icons';
import {
  X, ArrowRight, ArrowDown, Sparkles,
  Layers, ShieldCheck, User, Code, Info,
} from 'lucide-react';

const DIFFICULTY_STYLE = {
  Beginner:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  Advanced:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
};

function DifficultyBadge({ difficulty }) {
  const s = DIFFICULTY_STYLE[difficulty] || DIFFICULTY_STYLE.Beginner;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600,
      padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {difficulty}
    </span>
  );
}

export default function TemplateDetailsModal({
  template,
  onClose,
  onInstall,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!template) return null;

  const nodes = template.nodes || [];
  const edges = template.edges || [];

  // Group nodes by category
  const triggers = nodes.filter((n) => (n.type || '').startsWith('trigger-'));
  const actions = nodes.filter((n) => (n.type || '').startsWith('action-'));
  const logic = nodes.filter((n) => (n.type || '').startsWith('logic-'));

  const requiredConnections = template.requiredConnections || (template.requiresConnection ? [template.requiresConnection] : []);
  const requiredVariables = template.requiredVariables || [];

  return (
    <div
      id="template-details-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        id="template-details-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860,
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--accent-primary)',
              }}>
                {template.category?.replace('-', ' ')}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              {template.difficulty && <DifficultyBadge difficulty={template.difficulty} />}
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Code size={12} /> v{template.version || '1.0.0'}
              </span>
            </div>

            <h2 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, lineHeight: 1.3 }}>
              {template.name}
            </h2>

            {template.author && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={12} /> by <strong style={{ color: 'var(--text-secondary)' }}>{template.author.name}</strong> ({template.author.role})
              </div>
            )}
          </div>

          <button
            id="template-details-close-btn"
            onClick={onClose}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 8, cursor: 'pointer',
              color: 'var(--text-muted)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close template preview"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section: Overview & Use Case */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Description
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {template.description}
              </p>
            </div>

            {template.useCase && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-primary)', marginBottom: 4 }}>
                  Real-World Use Case
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
                  {template.useCase}
                </p>
              </div>
            )}

            {template.preview?.expectedOutcome && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Expected Result:</strong> {template.preview.expectedOutcome}
                </div>
              </div>
            )}
          </div>

          {/* Section: Breakdown & Requirements Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* Workflow Composition */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Workflow Breakdown
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22c55e' }}>{triggers.length}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trigger{triggers.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{actions.length}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Action{actions.length !== 1 ? 's' : ''}</span>
                </div>
                {logic.length > 0 && (
                  <>
                    <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>{logic.length}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Logic Node{logic.length !== 1 ? 's' : ''}</span>
                    </div>
                  </>
                )}
                <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{edges.length}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Connection{edges.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Connection Requirements */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Required Integrations
              </div>
              {requiredConnections.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: '0.82rem', fontWeight: 600 }}>
                  <Sparkles size={14} /> Ready to run — zero credentials needed
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {requiredConnections.map((conn) => (
                    <div key={conn} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#f59e0b' }}>
                      <ShieldCheck size={14} /> Requires active connection: <strong style={{ textTransform: 'capitalize' }}>{conn.replace('_', ' ')}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section: Visual Step-by-Step Sequence */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
              Step-by-Step Execution Sequence ({nodes.length} Steps)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nodes.map((node, idx) => {
                const IconComp = getNodeIcon(node.type);
                const isTrigger = (node.type || '').startsWith('trigger-');
                const isLogic = (node.type || '').startsWith('logic-');

                return (
                  <React.Fragment key={node.id}>
                    <div
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: isTrigger ? 'rgba(34,197,94,0.15)' : isLogic ? 'rgba(245,158,11,0.15)' : 'rgba(108,99,255,0.15)',
                          color: isTrigger ? '#22c55e' : isLogic ? '#f59e0b' : 'var(--accent-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>

                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-primary)', flexShrink: 0,
                        }}>
                          <IconComp size={16} />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.data?.label || node.id}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Type: <code>{node.type}</code>
                          </div>
                        </div>
                      </div>

                      {/* Summary details tag */}
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
                        {node.data?.url && <span title={node.data.url}>{node.data.method || 'GET'} {new URL(node.data.url, 'http://localhost').pathname}</span>}
                        {node.data?.cron && <span>Cron: {node.data.cron}</span>}
                        {node.data?.operation && <span style={{ textTransform: 'capitalize' }}>Operation: {node.data.operation}</span>}
                        {node.data?.table && <span>Table: {node.data.table}</span>}
                        {node.data?.operator && <span>Condition: {node.data.operator}</span>}
                      </div>
                    </div>

                    {idx < nodes.length - 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', my: -2 }}>
                        <ArrowDown size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Section: Configurable Variables */}
          {requiredVariables.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>
                Workflow Variables & Secrets
              </div>
              <div style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Variable Name</th>
                      <th style={{ padding: '8px 12px' }}>Type</th>
                      <th style={{ padding: '8px 12px' }}>Default</th>
                      <th style={{ padding: '8px 12px' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredVariables.map((v) => (
                      <tr key={v.name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}><code>{v.name}</code></td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{v.type}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{String(v.default ?? '—')}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{v.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Back to Catalog
          </button>

          <button
            id="template-details-install-btn"
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              onInstall(template);
            }}
          >
            Use Template <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

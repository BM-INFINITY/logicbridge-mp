import React, { useState } from 'react';
import { Database, X, Braces, SlidersHorizontal, Lock } from 'lucide-react';
import useWorkflowStore from '../store/workflowStore';

/**
 * VariablePicker Modal / Popover
 * Displays output schema from upstream steps, workflow variables, and encrypted workflow secrets.
 * Clicking any item calls `onSelect('{{ expression }}')`.
 */
export default function VariablePicker({ nodes, edges, currentNodeId, onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('steps'); // 'steps' | 'variables' | 'secrets'
  const [searchTerm, setSearchTerm] = useState('');
  const { variables = [], secrets = [] } = useWorkflowStore();

  // Find upstream nodes (nodes connected to or positioned before currentNodeId)
  const currentNodeIndex = (nodes || []).findIndex((n) => n.id === currentNodeId);
  const upstreamNodes = (nodes || []).filter((n, idx) => n.id !== currentNodeId && idx < currentNodeIndex);

  // Fallback default sample fields if upstream outputs aren't cached yet
  const getStepSampleKeys = (node) => {
    if (node.data?._lastOutput) {
      const out = node.data._lastOutput;
      if (out.records && Array.isArray(out.records) && out.records[0]) {
        return Object.keys(out.records[0]);
      }
      if (out.data?.records && Array.isArray(out.data.records) && out.data.records[0]) {
        return Object.keys(out.data.records[0]);
      }
      if (Array.isArray(out) && out[0]) return Object.keys(out[0]);
      if (out?.data && Array.isArray(out.data) && out.data[0]) return Object.keys(out.data[0]);
      if (out?.data && typeof out.data === 'object') return Object.keys(out.data);
      if (typeof out === 'object') return Object.keys(out);
    }

    if (node.type === 'action-http' || node.data?.url?.includes('google')) {
      return ['Enrollment No.', 'Name of Student', 'Branch', 'Team Id', 'Guide', 'Attendance (%)'];
    }
    return ['output', 'status', 'data', 'id'];
  };

  const filteredVariables = variables.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSecrets = secrets.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 390,
        width: 340,
        maxHeight: 500,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent-primary)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-glow)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(108,99,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Braces size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Insert Reference</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: '4px 6px',
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory('steps')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: activeCategory === 'steps' ? 700 : 500,
            background: activeCategory === 'steps' ? 'var(--bg-elevated)' : 'transparent',
            color: activeCategory === 'steps' ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Database size={11} /> Steps ({upstreamNodes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('variables')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: activeCategory === 'variables' ? 700 : 500,
            background: activeCategory === 'variables' ? 'var(--bg-elevated)' : 'transparent',
            color: activeCategory === 'variables' ? '#06b6d4' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={11} /> Variables ({variables.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('secrets')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: activeCategory === 'secrets' ? 700 : 500,
            background: activeCategory === 'secrets' ? 'var(--bg-elevated)' : 'transparent',
            color: activeCategory === 'secrets' ? '#ec4899' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Lock size={11} /> Secrets ({secrets.length})
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          className="form-input"
          placeholder={
            activeCategory === 'steps'
              ? 'Search step outputs...'
              : activeCategory === 'variables'
              ? 'Search variables...'
              : 'Search secrets...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}
        />
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {/* Upstream Steps Tab */}
        {activeCategory === 'steps' && (
          <div>
            {upstreamNodes.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                No upstream steps found.<br />Add a node prior to this step to expose its output.
              </div>
            ) : (
              upstreamNodes.map((node) => {
                const keys = getStepSampleKeys(node).filter((k) => k.toLowerCase().includes(searchTerm.toLowerCase()));
                const stepName = node.data?.label || node.type;

                return (
                  <div
                    key={node.id}
                    style={{
                      marginBottom: 10,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        marginBottom: 6,
                      }}
                    >
                      <Database size={12} />
                      <span>{stepName}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        ({node.id})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {keys.map((key) => {
                        const variableStr = `{{steps.${node.id}.${key}}}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              onSelect(variableStr);
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                              e.currentTarget.style.background = 'rgba(108,99,255,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.background = 'var(--bg-elevated)';
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {key}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
                              {variableStr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Workflow Variables Tab */}
        {activeCategory === 'variables' && (
          <div>
            {filteredVariables.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {variables.length === 0 ? (
                  <>
                    No workflow variables defined.<br />
                    Click <strong>Variables & Secrets</strong> in toolbar to add one.
                  </>
                ) : (
                  'No matching variables found.'
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredVariables.map((v) => {
                  const variableStr = `{{variables.${v.name}}}`;
                  return (
                    <button
                      key={v._id || v.name}
                      type="button"
                      onClick={() => {
                        onSelect(variableStr);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#06b6d4';
                        e.currentTarget.style.background = 'rgba(6,182,212,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: 'rgba(6,182,212,0.15)',
                            color: '#06b6d4',
                          }}
                        >
                          VAR
                        </span>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {v.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#06b6d4' }}>
                        {variableStr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Workflow Secrets Tab */}
        {activeCategory === 'secrets' && (
          <div>
            {filteredSecrets.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {secrets.length === 0 ? (
                  <>
                    No encrypted secrets configured.<br />
                    Click <strong>Variables & Secrets</strong> in toolbar to configure.
                  </>
                ) : (
                  'No matching secrets found.'
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredSecrets.map((s) => {
                  const secretStr = `{{secrets.${s.name}}}`;
                  return (
                    <button
                      key={s._id || s.name}
                      type="button"
                      onClick={() => {
                        onSelect(secretStr);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#ec4899';
                        e.currentTarget.style.background = 'rgba(236,72,153,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: 'rgba(236,72,153,0.15)',
                            color: '#ec4899',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Lock size={9} />
                          SECRET
                        </span>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#ec4899' }}>
                        {secretStr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

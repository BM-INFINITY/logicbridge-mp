import React, { useState } from 'react';
import { Database, ChevronRight, Sparkles, X, Code, Braces } from 'lucide-react';

/**
 * VariablePicker Modal / Popover
 * Displays output schema & keys from all upstream nodes in the flow.
 * Clicking a field calls `onSelect('{{ step_id.field }}')`.
 */
export default function VariablePicker({ nodes, edges, currentNodeId, onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Find upstream nodes (nodes connected to or positioned before currentNodeId)
  const currentNodeIndex = nodes.findIndex(n => n.id === currentNodeId);
  const upstreamNodes = nodes.filter((n, idx) => n.id !== currentNodeId && idx < currentNodeIndex);

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

    // Default rich sample schemas including Attendance & IMD fields
    if (node.type === 'action-http' || node.data?.url?.includes('google')) {
      return ['Enrollment No.', 'Name of Student', 'Branch', 'Team Id', 'Guide', 'First Internal Examiner', 'Attendance (%)', 'Week 29 June', 'Week 6 July', 'Week 13 July'];
    }
    if (node.type === 'action-http' || node.data?.url?.includes('imd')) {
      return ['Station Id', 'Station', 'Temperature', 'Humidity', 'M.S.L.P', 'Wind Speed', 'Date of Observation', 'Time of Observation', 'Last 24 hrs Rainfall'];
    }
    return ['Enrollment No.', 'Name of Student', 'Team Id', 'Attendance (%)', 'output', 'status'];
  };

  return (
    <div style={{
      position: 'absolute', top: 60, right: 390, width: 320, maxHeight: 480,
      background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)',
      borderRadius: 14, boxShadow: 'var(--shadow-glow)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(108,99,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Braces size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Insert Dynamic Variable</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search fields (e.g. Station, Temp)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '6px 10px' }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {upstreamNodes.length === 0 ? (
          <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            No upstream steps available yet.<br />Add a Trigger or HTTP node before this step.
          </div>
        ) : (
          upstreamNodes.map(node => {
            const keys = getStepSampleKeys(node).filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
            const stepName = node.data?.label || node.type;

            return (
              <div key={node.id} style={{ marginBottom: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 6 }}>
                  <Database size={13} />
                  <span>{stepName}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>({node.id})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {keys.map(key => {
                    const variableStr = `{{ ${node.id}.${key} }}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { onSelect(variableStr); onClose(); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '5px 8px', borderRadius: 6, background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(108,99,255,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      >
                        <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{key}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>{variableStr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

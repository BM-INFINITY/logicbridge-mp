import React from 'react';
import { Plus, Trash2, GitFork, Info } from 'lucide-react';
import { TextField } from '../forms';
import { CONDITION_OPERATORS } from '../../constants/ConditionOperators';

export default function SwitchConfig({ data, onChange, onOpenVariablePicker }) {
  const cases = Array.isArray(data.cases) ? data.cases : [];
  const defaultHandle = data.defaultHandle || 'default';

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const addCase = () => {
    const nextIdx = cases.length + 1;
    const newCase = {
      id: `case_${nextIdx}`,
      label: `Case ${nextIdx}`,
      operator: 'equals',
      value: '',
    };
    onChange({ ...data, cases: [...cases, newCase] });
  };

  const updateCase = (index, updatedCase) => {
    const nextCases = [...cases];
    nextCases[index] = updatedCase;
    onChange({ ...data, cases: nextCases });
  };

  const removeCase = (index) => {
    const nextCases = cases.filter((_, i) => i !== index);
    onChange({ ...data, cases: nextCases });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Input Expression */}
      <TextField
        label="Input Expression to Evaluate"
        placeholder="{{steps.api.data.role}} or {{prev.status}}"
        value={data.input || ''}
        onChange={(val) => updateField('input', val)}
        onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('input')}
        hint="The value evaluated against configured cases below."
      />

      {/* Cases List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitFork size={14} color="#8b5cf6" />
            Switch Cases ({cases.length})
          </label>
          <button
            type="button"
            onClick={addCase}
            style={{
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#8b5cf6',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={12} /> Add Case
          </button>
        </div>

        {cases.map((c, idx) => (
          <div
            key={c.id || idx}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(139, 92, 246, 0.2)',
                    color: '#8b5cf6',
                  }}
                >
                  {c.id || `case_${idx + 1}`}
                </span>
                <input
                  type="text"
                  placeholder="Case Label"
                  value={c.label || ''}
                  onChange={(e) => updateCase(idx, { ...c, label: e.target.value })}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed var(--border)',
                    color: 'var(--text-base)',
                    padding: '2px 4px',
                    width: 140,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeCase(idx)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: 2,
                }}
                title="Remove Case"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={c.operator || 'equals'}
                onChange={(e) => updateCase(idx, { ...c, operator: e.target.value })}
                style={{
                  width: '45%',
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-base)',
                }}
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Match Value"
                value={c.value !== undefined ? String(c.value) : ''}
                onChange={(e) => updateCase(idx, { ...c, value: e.target.value })}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '0.78rem',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-base)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Default Fallback Route */}
      <div
        style={{
          background: 'rgba(100, 116, 139, 0.08)',
          border: '1px dashed rgba(100, 116, 139, 0.3)',
          borderRadius: 8,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>
            Fallback Branch: {defaultHandle.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Always Active</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          If none of the above cases evaluate to TRUE, execution routes automatically to the <strong>default</strong> output handle.
        </p>
      </div>

      {/* Strategy Guidance */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
        <Info size={14} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          <strong>First-Match Routing:</strong> Cases evaluate sequentially from top to bottom. Exactly one matching branch executes; all other branch paths are skipped.
        </div>
      </div>
    </div>
  );
}

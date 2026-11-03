import React, { useState } from 'react';
import { Plus, Trash2, Layers, Info } from 'lucide-react';
import { TextField, SelectField } from '../forms';

import { CONDITION_OPERATORS, UNARY_OPERATORS } from '../../constants/ConditionOperators';
export { CONDITION_OPERATORS, UNARY_OPERATORS };

export default function ConditionConfig({ data, onChange, onOpenVariablePicker }) {
  const isAdvancedInitial = Array.isArray(data.conditions) && data.conditions.length > 0;
  const [mode, setMode] = useState(isAdvancedInitial ? 'advanced' : 'simple');

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  // ── Switch Mode Handler ───────────────────────────────────────────────────
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'advanced') {
      const initialConditions = Array.isArray(data.conditions) && data.conditions.length > 0
        ? data.conditions
        : [
            {
              leftValue: data.leftValue || '',
              operator: data.operator || 'equals',
              rightValue: data.rightValue || '',
            },
          ];
      onChange({
        ...data,
        combinator: data.combinator || 'and',
        conditions: initialConditions,
      });
    } else {
      // Switch back to simple: extract first condition if available
      const first = Array.isArray(data.conditions) && data.conditions[0];
      onChange({
        ...data,
        leftValue: first?.leftValue !== undefined ? first.leftValue : (data.leftValue || ''),
        operator: first?.operator || (data.operator || 'equals'),
        rightValue: first?.rightValue !== undefined ? first.rightValue : (data.rightValue || ''),
        conditions: [],
      });
    }
  };

  // ── Condition Group Helpers ───────────────────────────────────────────────
  const conditions = Array.isArray(data.conditions) ? data.conditions : [];

  const updateCondition = (index, updatedCond) => {
    const next = [...conditions];
    next[index] = updatedCond;
    onChange({ ...data, conditions: next });
  };

  const removeCondition = (index) => {
    const next = conditions.filter((_, i) => i !== index);
    onChange({ ...data, conditions: next });
  };

  const addRule = () => {
    const next = [
      ...conditions,
      { leftValue: '', operator: 'equals', rightValue: '' },
    ];
    onChange({ ...data, conditions: next });
  };

  const addNestedGroup = () => {
    const next = [
      ...conditions,
      {
        combinator: 'and',
        conditions: [
          { leftValue: '', operator: 'equals', rightValue: '' },
        ],
      },
    ];
    onChange({ ...data, conditions: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => handleModeChange('simple')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: mode === 'simple' ? 'var(--accent)' : 'transparent',
            color: mode === 'simple' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          Simple
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('advanced')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: mode === 'advanced' ? 'var(--accent)' : 'transparent',
            color: mode === 'advanced' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          Group (AND / OR)
        </button>
      </div>

      {mode === 'simple' ? (
        /* ── Simple Single Condition ────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextField
            label="Left Value (or {{steps.node.field}})"
            placeholder="{{steps.api.data.status}}"
            value={data.leftValue || ''}
            onChange={(val) => updateField('leftValue', val)}
            onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('leftValue')}
          />

          <SelectField
            label="Operator"
            value={data.operator || 'equals'}
            onChange={(val) => updateField('operator', val)}
            options={CONDITION_OPERATORS}
          />

          {!UNARY_OPERATORS.has(data.operator) ? (
            <TextField
              label="Right Value"
              placeholder="active or 200"
              value={data.rightValue !== undefined ? String(data.rightValue) : ''}
              onChange={(val) => updateField('rightValue', val)}
              onInsertVariable={() => onOpenVariablePicker && onOpenVariablePicker('rightValue')}
            />
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6 }}>
              ℹ️ Unary operator: No right value required
            </div>
          )}
        </div>
      ) : (
        /* ── Advanced AND / OR Groups ───────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Combinator Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-base)' }}>
              Logical Combinator
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {['and', 'or'].map((comb) => {
                const active = (data.combinator || 'and').toLowerCase() === comb;
                return (
                  <button
                    key={comb}
                    type="button"
                    onClick={() => updateField('combinator', comb)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-card)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {comb.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {(data.combinator || 'and').toLowerCase() === 'and'
              ? 'All conditions must evaluate to TRUE to take the True branch.'
              : 'At least ONE condition must evaluate to TRUE to take the True branch.'}
          </div>

          {/* Condition Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conditions.map((item, idx) => {
              const isNestedGroup = Array.isArray(item.conditions);

              if (isNestedGroup) {
                return (
                  <div
                    key={`group_${idx}`}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(108, 99, 255, 0.3)',
                      borderRadius: 8,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Layers size={13} />
                        Group ({item.combinator?.toUpperCase() || 'AND'})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                        title="Delete Group"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Sub-conditions */}
                    {(item.conditions || []).map((subRule, sIdx) => (
                      <div key={`sub_${sIdx}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Left Value"
                          value={subRule.leftValue || ''}
                          onChange={(e) => {
                            const nextSub = [...item.conditions];
                            nextSub[sIdx] = { ...subRule, leftValue: e.target.value };
                            updateCondition(idx, { ...item, conditions: nextSub });
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            color: 'var(--text-base)',
                          }}
                        />
                        <select
                          value={subRule.operator || 'equals'}
                          onChange={(e) => {
                            const nextSub = [...item.conditions];
                            nextSub[sIdx] = { ...subRule, operator: e.target.value };
                            updateCondition(idx, { ...item, conditions: nextSub });
                          }}
                          style={{
                            width: 90,
                            padding: '4px 6px',
                            fontSize: '0.72rem',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            color: 'var(--text-base)',
                          }}
                        >
                          {CONDITION_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        {!UNARY_OPERATORS.has(subRule.operator) && (
                          <input
                            type="text"
                            placeholder="Right Value"
                            value={subRule.rightValue !== undefined ? String(subRule.rightValue) : ''}
                            onChange={(e) => {
                              const nextSub = [...item.conditions];
                              nextSub[sIdx] = { ...subRule, rightValue: e.target.value };
                              updateCondition(idx, { ...item, conditions: nextSub });
                            }}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-base)',
                            }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const nextSub = item.conditions.filter((_, i) => i !== sIdx);
                            updateCondition(idx, { ...item, conditions: nextSub });
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const nextSub = [...(item.conditions || []), { leftValue: '', operator: 'equals', rightValue: '' }];
                        updateCondition(idx, { ...item, conditions: nextSub });
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        background: 'transparent',
                        border: '1px dashed var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        marginTop: 2,
                      }}
                    >
                      + Add Rule in Group
                    </button>
                  </div>
                );
              }

              // Standard Single Condition in List
              return (
                <div
                  key={`cond_${idx}`}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Rule #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                      title="Delete Rule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Left Value (e.g. {{steps.api.total}})"
                      value={item.leftValue || ''}
                      onChange={(e) => updateCondition(idx, { ...item, leftValue: e.target.value })}
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

                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      value={item.operator || 'equals'}
                      onChange={(e) => updateCondition(idx, { ...item, operator: e.target.value })}
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

                    {!UNARY_OPERATORS.has(item.operator) ? (
                      <input
                        type="text"
                        placeholder="Right Value"
                        value={item.rightValue !== undefined ? String(item.rightValue) : ''}
                        onChange={(e) => updateCondition(idx, { ...item, rightValue: e.target.value })}
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
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Unary check
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={addRule}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(108, 99, 255, 0.1)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                color: 'var(--accent)',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Plus size={13} /> Add Rule
            </button>
            <button
              type="button"
              onClick={addNestedGroup}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#8b5cf6',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Layers size={13} /> Add Group
            </button>
          </div>
        </div>
      )}

      {/* Info Tip */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
        <Info size={14} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Supports string, numeric, boolean, null, array, and regex comparisons with safe ReDoS bounds. True and False outputs route downstream flow.
        </div>
      </div>
    </div>
  );
}

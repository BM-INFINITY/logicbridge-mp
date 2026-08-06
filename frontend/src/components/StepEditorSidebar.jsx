import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Play, Braces, Sparkles, Check, FileSpreadsheet, Settings, Sliders, ChevronDown, Layers } from 'lucide-react';
import { NODE_DEFS } from '../data/templates';
import VariablePicker from './VariablePicker';
import API from '../api/client';
import toast from 'react-hot-toast';

export default function StepEditorSidebar({ node, nodes, edges, onUpdate, onDelete, onClose, workflowId }) {
  const [data, setData] = useState({ ...node?.data });
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'test'
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [activeInputRef, setActiveInputRef] = useState(null); // { field, index, prop }
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setData({ ...node?.data });
    setTestResult(null);
  }, [node?.id]);

  if (!node) return null;
  const def = NODE_DEFS[node.type] || { label: node.type, icon: '⚙️', color: '#6c63ff', category: 'action' };

  const handleChange = (key, val) => {
    const updated = { ...data, [key]: val };
    setData(updated);
    onUpdate(node.id, updated);
  };

  // ── CSV Column Mapping Helpers ─────────────────────────────────────────────
  const columns = data.columns || [
    { header: 'Station Name', value: '{{ step_1.Station }}' },
    { header: 'Temperature (°C)', value: '{{ step_1.Temperature }}' },
  ];

  const updateColumn = (index, key, val) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], [key]: val };
    handleChange('columns', updated);
  };

  const addColumn = () => {
    const updated = [...columns, { header: `Column ${columns.length + 1}`, value: '' }];
    handleChange('columns', updated);
  };

  const removeColumn = (index) => {
    const updated = columns.filter((_, i) => i !== index);
    handleChange('columns', updated);
  };

  const autoDetectColumns = () => {
    const currentNodeIndex = nodes.findIndex(n => n.id === node.id);
    const upstreamNodes = nodes.filter((n, idx) => n.id !== node.id && (currentNodeIndex === -1 || idx < currentNodeIndex));

    let detectedKeys = [];
    let detectedArrayPath = '';

    for (const uNode of upstreamNodes.reverse()) {
      const out = uNode.data?._lastOutput;
      if (!out) continue;

      let targetArr = [];
      if (Array.isArray(out)) targetArr = out;
      else if (out.records && Array.isArray(out.records)) { targetArr = out.records; detectedArrayPath = 'records'; }
      else if (out.data && Array.isArray(out.data)) { targetArr = out.data; detectedArrayPath = 'data'; }
      else if (out.items && Array.isArray(out.items)) { targetArr = out.items; detectedArrayPath = 'items'; }
      else if (out.results && Array.isArray(out.results)) { targetArr = out.results; detectedArrayPath = 'results'; }
      else if (typeof out === 'object') {
        const arrEntry = Object.entries(out).find(([, val]) => Array.isArray(val) && val.length > 0);
        if (arrEntry) { targetArr = arrEntry[1]; detectedArrayPath = arrEntry[0]; }
      }

      if (targetArr.length > 0 && typeof targetArr[0] === 'object') {
        detectedKeys = Object.keys(targetArr[0]);
        break;
      }
    }

    if (detectedKeys.length > 0) {
      const newCols = detectedKeys.map(k => ({ header: k, value: `{{ ${k} }}` }));
      handleChange('columns', newCols);
      if (detectedArrayPath) handleChange('arrayPath', detectedArrayPath);
      toast.success(`Auto-detected ${detectedKeys.length} columns!`);
    } else {
      // Default IMD / Attendance fallback if step hasn't been tested yet
      const fallback = [
        { header: 'Enrollment No.', value: '{{ Enrollment No. }}' },
        { header: 'Name of Student', value: '{{ Name of Student }}' },
        { header: 'Branch', value: '{{ Branch }}' },
        { header: 'Team Id', value: '{{ Team Id }}' },
        { header: 'Attendance (%)', value: '{{ Attendance (%) }}' },
      ];
      handleChange('columns', fallback);
      handleChange('arrayPath', 'records');
      toast.success('Generated default columns for student attendance data!');
    }
  };

  // ── Key-Value Pair Helpers (Params / Headers) ──────────────────────────────
  const updateKvPair = (arrayKey, index, field, val) => {
    const current = data[arrayKey] || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: val };
    handleChange(arrayKey, updated);
  };

  const addKvPair = (arrayKey) => {
    const current = data[arrayKey] || [];
    handleChange(arrayKey, [...current, { key: '', value: '' }]);
  };

  const removeKvPair = (arrayKey, index) => {
    const current = data[arrayKey] || [];
    handleChange(arrayKey, current.filter((_, i) => i !== index));
  };

  // Insert dynamic variable into active field
  const handleInsertVariable = (variableStr) => {
    if (!activeInputRef) return;
    const { type, field, index } = activeInputRef;

    if (type === 'column-value') {
      updateColumn(index, 'value', (columns[index]?.value || '') + ' ' + variableStr);
    } else if (type === 'kv-value') {
      const arr = data[field] || [];
      updateKvPair(field, index, 'value', (arr[index]?.value || '') + ' ' + variableStr);
    } else {
      handleChange(field, (data[field] || '') + ' ' + variableStr);
    }
  };

  // ── Test Step Handler ──────────────────────────────────────────────────────
  const handleTestStep = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (workflowId) {
        const { data: res } = await API.post(`/api/workflows/${workflowId}/run`);
        const stepRes = res.steps?.find(s => s.nodeId === node.id) || res.steps?.[res.steps.length - 1];
        setTestResult(stepRes || res);
      } else {
        // Simulated test response for demo
        await new Promise(r => setTimeout(r, 800));
        setTestResult({
          status: 'success',
          output: node.type === 'action-csv' ? {
            filename: `${data.filename || 'export'}.csv`,
            rowsGenerated: 147,
            columns: columns.map(c => c.header),
            sampleCsv: `${columns.map(c => c.header).join(',')}\n"Ahmedabad","34.5"\n"Rajkot","32.0"\n"Surat","31.8"`,
          } : { status: 200, message: 'Step executed successfully' },
          duration: 140,
        });
      }
      toast.success('Step tested successfully!');
    } catch (err) {
      setTestResult({ status: 'failed', error: err.response?.data?.message || err.message });
      toast.error('Test execution failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 390, height: '100%',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 90,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.4)', animation: 'slideInRight 0.2s ease',
    }}>
      {/* ── Sidebar Header ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${def.color}22`, color: def.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {def.icon}
          </div>
          <div>
            <input
              type="text"
              value={data.label || def.label}
              onChange={e => handleChange('label', e.target.value)}
              style={{ background: 'transparent', border: 'none', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', width: 190, outline: 'none' }}
              placeholder="Step Name..."
            />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{def.category.toUpperCase()}</span> · <span style={{ color: def.color }}>{node.type}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onDelete(node.id)} className="btn btn-sm btn-ghost" style={{ color: 'var(--accent-danger)', padding: 6 }} title="Delete step">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ color: 'var(--text-muted)', padding: 6 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Tabs (Settings / Test Step) ────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none',
            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'settings' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Sliders size={14} /> Configuration
        </button>
        <button
          onClick={() => setActiveTab('test')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none',
            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            color: activeTab === 'test' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'test' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Play size={14} /> Test Step
        </button>
      </div>

      {/* ── Main Tab Content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 30px' }}>
        {activeTab === 'settings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── ACTION: GENERATE CSV ───────────────────────────────────── */}
            {node.type === 'action-csv' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem' }}>CSV Columns & Field Mapping</label>
                  <button type="button" onClick={autoDetectColumns} style={{ background: 'none', border: 'none', color: '#22d3ee', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} /> Auto-Detect
                  </button>
                </div>

                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: -8 }}>
                  Define the exact CSV header names and map which dynamic variables or values should go into each column.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {columns.map((col, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>COLUMN #{idx + 1}</span>
                        {columns.length > 1 && (
                          <button onClick={() => removeColumn(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 2 }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Header Name</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                            placeholder="e.g. Station Name"
                            value={col.header}
                            onChange={e => updateColumn(idx, 'header', e.target.value)}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Field Value</label>
                            <button
                              type="button"
                              onClick={() => { setActiveInputRef({ type: 'column-value', index: idx }); setShowVariablePicker(true); }}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}
                            >
                              + Variable
                            </button>
                          </div>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.78rem', padding: '6px 8px', fontFamily: 'monospace' }}
                            placeholder="{{ step_1.Station }}"
                            value={col.value}
                            onChange={e => updateColumn(idx, 'value', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addColumn}
                    className="btn btn-secondary w-full"
                    style={{ fontSize: '0.8rem', padding: '8px', borderStyle: 'dashed' }}
                  >
                    <Plus size={14} /> Add Column
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Delimiter</label>
                    <select
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                      value={data.delimiter || ','}
                      onChange={e => handleChange('delimiter', e.target.value)}
                    >
                      <option value=",">Comma ( , ) — Standard CSV</option>
                      <option value=";">Semicolon ( ; ) — European CSV</option>
                      <option value="\t">Tab ( \t ) — TSV</option>
                      <option value="|">Pipe ( | )</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Include Column Header Row?</label>
                    <select
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                      value={data.includeHeaders ?? 'true'}
                      onChange={e => handleChange('includeHeaders', e.target.value)}
                    >
                      <option value="true">Yes — Include Header Row at top</option>
                      <option value="false">No — Data Rows Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Output Filename (Saved in /exports)</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                      placeholder="imd_weather_report"
                      value={data.filename || 'imd_weather'}
                      onChange={e => handleChange('filename', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── ACTION: HTTP REQUEST ────────────────────────────────────── */}
            {node.type === 'action-http' && (
              <>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label">Request URL</label>
                    <button
                      type="button"
                      onClick={() => { setActiveInputRef({ type: 'field', field: 'url' }); setShowVariablePicker(true); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Insert Variable
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    placeholder="https://api.imd.gov.in/api/v1/current_wx"
                    value={data.url || ''}
                    onChange={e => handleChange('url', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HTTP Method</label>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    value={data.method || 'GET'}
                    onChange={e => handleChange('method', e.target.value)}
                  >
                    <option value="GET">GET — Fetch Data</option>
                    <option value="POST">POST — Send Body Data</option>
                    <option value="PUT">PUT — Update Resource</option>
                    <option value="DELETE">DELETE — Remove Resource</option>
                  </select>
                </div>

                {/* Query Parameters Key-Value list */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>URL Query Parameters</label>
                    <button type="button" onClick={() => addKvPair('queryParamsList')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                      + Add Query Param
                    </button>
                  </div>
                  {(data.queryParamsList || []).map((qp, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px' }} placeholder="Param Key (e.g. sheetuser)" value={qp.key} onChange={e => updateKvPair('queryParamsList', i, 'key', e.target.value)} />
                      <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px' }} placeholder="Value (e.g. 23012011002)" value={qp.value} onChange={e => updateKvPair('queryParamsList', i, 'value', e.target.value)} />
                      <button onClick={() => removeKvPair('queryParamsList', i)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Easily edit URL query params (like sheetuser=23012011002 or 23012011003)
                  </div>
                </div>

                {/* Headers Key-Value list */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Headers</label>
                    <button type="button" onClick={() => addKvPair('headersList')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                      + Add Header
                    </button>
                  </div>
                  {(data.headersList || []).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px' }} placeholder="Key (e.g. Authorization)" value={h.key} onChange={e => updateKvPair('headersList', i, 'key', e.target.value)} />
                      <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px' }} placeholder="Value" value={h.value} onChange={e => updateKvPair('headersList', i, 'value', e.target.value)} />
                      <button onClick={() => removeKvPair('headersList', i)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>

                {data.method !== 'GET' && (
                  <div className="form-group">
                    <label className="form-label">Request Body (JSON)</label>
                    <textarea
                      className="form-input"
                      style={{ fontSize: '0.78rem', padding: '8px 10px', minHeight: 90, fontFamily: 'monospace' }}
                      placeholder='{"stationId": "42182"}'
                      value={data.body || ''}
                      onChange={e => handleChange('body', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* ── TRIGGER: SCHEDULE ────────────────────────────────────────── */}
            {node.type === 'trigger-schedule' && (
              <>
                <div className="form-group">
                  <label className="form-label">Schedule Presets</label>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                    value={data.cron || '0 8 * * *'}
                    onChange={e => handleChange('cron', e.target.value)}
                  >
                    <option value="0 8 * * *">Every Day at 8:00 AM IST (Daily Weather Export)</option>
                    <option value="0 * * * *">Every Hour (at top of hour)</option>
                    <option value="*/15 * * * *">Every 15 Minutes</option>
                    <option value="0 0 * * 1">Every Monday at Midnight</option>
                    <option value="0 18 * * 1-5">Weekdays at 6:00 PM</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Custom Cron Expression</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '8px 10px', fontFamily: 'monospace' }}
                    value={data.cron || '0 8 * * *'}
                    onChange={e => handleChange('cron', e.target.value)}
                  />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Format: minute hour day-of-month month day-of-week
                  </div>
                </div>
              </>
            )}

            {/* ── ACTION: LOG OUTPUT ───────────────────────────────────────── */}
            {node.type === 'action-log' && (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="form-label">Log Message Template</label>
                  <button
                    type="button"
                    onClick={() => { setActiveInputRef({ type: 'field', field: 'message' }); setShowVariablePicker(true); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Insert Variable
                  </button>
                </div>
                <textarea
                  className="form-input"
                  style={{ fontSize: '0.8rem', padding: '8px 10px', minHeight: 80 }}
                  placeholder="CSV exported successfully! Rows: {{ prev.rowCount }}"
                  value={data.message || ''}
                  onChange={e => handleChange('message', e.target.value)}
                />
              </div>
            )}

            {/* ── LOGIC: CONDITION ────────────────────────────────────────── */}
            {node.type === 'logic-condition' && (
              <>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label">Variable / Left Field</label>
                    <button
                      type="button"
                      onClick={() => { setActiveInputRef({ type: 'field', field: 'leftValue' }); setShowVariablePicker(true); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Variable
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '8px 10px', fontFamily: 'monospace' }}
                    placeholder="{{ step_1.Temperature }}"
                    value={data.leftValue || ''}
                    onChange={e => handleChange('leftValue', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operator</label>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    value={data.operator || 'equals'}
                    onChange={e => handleChange('operator', e.target.value)}
                  >
                    <option value="equals">Equals ( == )</option>
                    <option value="not-equals">Does Not Equal ( != )</option>
                    <option value="greater-than">Greater Than ( &gt; )</option>
                    <option value="less-than">Less Than ( &lt; )</option>
                    <option value="contains">Contains Substring</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Compare Against / Right Value</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    placeholder="35"
                    value={data.rightValue || ''}
                    onChange={e => handleChange('rightValue', e.target.value)}
                  />
                </div>
              </>
            )}

          </div>
        ) : (
          /* ── TEST STEP TAB ──────────────────────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Execute this step directly to inspect live output schema and sample data.
            </p>

            <button
              onClick={handleTestStep}
              className="btn btn-primary w-full"
              disabled={testing}
              style={{ fontSize: '0.85rem', padding: '10px' }}
            >
              {testing ? <><span className="spinner" /> Testing Step...</> : <><Play size={15} /> Run Step Test</>}
            </button>

            {testResult && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: testResult.status === 'failed' ? 'var(--accent-danger)' : '#22c55e' }}>
                    {testResult.status === 'failed' ? '❌ Test Failed' : '✅ Test Succeeded'}
                  </span>
                  {testResult.duration && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{testResult.duration}ms</span>}
                </div>

                <pre style={{
                  fontSize: '0.74rem', color: '#22d3ee', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: 12,
                  maxHeight: 280, overflowY: 'auto', margin: 0, fontFamily: 'monospace',
                }}>
                  {JSON.stringify(testResult.output || testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Variable Picker Popup Overlay ─────────────────────────────────── */}
      {showVariablePicker && (
        <VariablePicker
          nodes={nodes}
          edges={edges}
          currentNodeId={node.id}
          onSelect={handleInsertVariable}
          onClose={() => setShowVariablePicker(false)}
        />
      )}
    </div>
  );
}

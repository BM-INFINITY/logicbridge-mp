import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, AlertCircle } from 'lucide-react';
import { SelectField, TextField, CodeEditor } from '../forms';
import API from '../../api/client';
import NodeValidator from '../../validators/NodeValidator';
import { NodeTypes } from '../../constants/NodeTypes';

const OPERATION_OPTIONS = [
  { value: 'get_rows', label: 'Get Rows' },
  { value: 'get_row', label: 'Get Row' },
  { value: 'add_row', label: 'Add Row' },
  { value: 'update_row', label: 'Update Row' },
  { value: 'delete_row', label: 'Delete Row' },
  { value: 'find_row', label: 'Find Row' },
];

export default function GoogleSheetsConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const sheetsConns = all.filter(
          (c) => c.status === 'active' && (c.provider === 'google_sheets' || c.provider === 'google-sheets')
        );
        setConnections(sheetsConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const operation = data.operation || 'get_rows';
  const opKey = String(operation).toLowerCase().replace(/[^a-z]/g, '');
  const validation = NodeValidator.validateNode({ type: NodeTypes.ACTION_GOOGLE_SHEETS, data });

  const handleInsertVar = (fieldKey) => {
    if (onOpenVariablePicker) {
      onOpenVariablePicker((variableStr) => {
        const currentVal = data[fieldKey] || '';
        updateField(fieldKey, currentVal + variableStr);
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Connection Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={11} /> Google Connection
          </label>
          <button
            type="button"
            onClick={fetchConnections}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title="Refresh connections"
          >
            <RefreshCw size={11} style={{ animation: loadingConns ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {connections.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
            fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
              <AlertCircle size={13} />
              <span>No active Google Sheets connections</span>
            </div>
            <div>
              Connect your Google account in <a href="/connections" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Connections</a> to access Google Sheets.
            </div>
          </div>
        ) : (
          <select
            id="sheets-connection-select"
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
          >
            <option value="">Select a connection…</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.email || 'Google Account'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Spreadsheet ID / URL */}
      <TextField
        label="Spreadsheet ID or URL"
        placeholder="https://docs.google.com/spreadsheets/d/... or ID"
        value={data.spreadsheet || data.spreadsheetId || ''}
        onChange={(val) => updateField('spreadsheet', val)}
        onInsertVariable={() => handleInsertVar('spreadsheet')}
        helperText="Paste the full Google Sheets link or the alphanumeric ID"
      />

      {/* Sheet / Tab Name */}
      <TextField
        label="Sheet Name"
        placeholder="Sheet1"
        value={data.sheet || data.sheetName || 'Sheet1'}
        onChange={(val) => updateField('sheet', val)}
        onInsertVariable={() => handleInsertVar('sheet')}
        helperText="Name of the tab in your spreadsheet (default Sheet1)"
      />

      {/* Operation selector */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATION_OPTIONS}
      />

      {/* Operation-specific fields */}
      {opKey === 'getrows' && (
        <TextField
          label="Custom Range (Optional)"
          placeholder="A1:Z (defaults to entire sheet)"
          value={data.range || ''}
          onChange={(val) => updateField('range', val)}
          onInsertVariable={() => handleInsertVar('range')}
          helperText="Optional range like A1:Z"
        />
      )}

      {(opKey === 'getrow' || opKey === 'deleterow') && (
        <TextField
          label="Row Number"
          placeholder="2"
          value={data.rowNumber !== undefined ? String(data.rowNumber) : ''}
          onChange={(val) => updateField('rowNumber', val)}
          onInsertVariable={() => handleInsertVar('rowNumber')}
          helperText="1-based row index (Row 1 is usually headers)"
        />
      )}

      {opKey === 'updaterow' && (
        <>
          <TextField
            label="Row Number to Update"
            placeholder="2"
            value={data.rowNumber !== undefined ? String(data.rowNumber) : ''}
            onChange={(val) => updateField('rowNumber', val)}
            onInsertVariable={() => handleInsertVar('rowNumber')}
            helperText="1-based row index to overwrite"
          />
          <CodeEditor
            label="Row Values (JSON Array or Object)"
            placeholder='["John Doe", "john@example.com", "Active"]'
            value={typeof data.row === 'object' ? JSON.stringify(data.row, null, 2) : (data.row || data.values || '')}
            onChange={(val) => updateField('row', val)}
            onInsertVariable={() => handleInsertVar('row')}
            minHeight={90}
            helperText='Array of column values or JSON object matching headers'
          />
        </>
      )}

      {(opKey === 'addrow' || opKey === 'append') && (
        <CodeEditor
          label="Row Values (JSON Array or Object)"
          placeholder='{"Name": "{{trigger.body.name}}", "Email": "{{trigger.body.email}}"}'
          value={typeof data.row === 'object' ? JSON.stringify(data.row, null, 2) : (data.row || data.values || '')}
          onChange={(val) => updateField('row', val)}
          onInsertVariable={() => handleInsertVar('row')}
          minHeight={90}
          helperText='Array of cell values like ["Val1", "Val2"] or JSON object mapped to headers'
        />
      )}

      {opKey === 'findrow' && (
        <>
          <TextField
            label="Search Column"
            placeholder="A or Email"
            value={data.searchColumn || ''}
            onChange={(val) => updateField('searchColumn', val)}
            onInsertVariable={() => handleInsertVar('searchColumn')}
            helperText="Column letter (e.g. A, B) or header name"
          />
          <TextField
            label="Search Value"
            placeholder="{{prev.email}} or target string"
            value={data.searchValue !== undefined ? String(data.searchValue) : ''}
            onChange={(val) => updateField('searchValue', val)}
            onInsertVariable={() => handleInsertVar('searchValue')}
            helperText="Exact or case-insensitive value to match"
          />
        </>
      )}

      {/* Validation Message */}
      {!validation.valid && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          color: '#ef4444', fontSize: '0.75rem',
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{validation.error}</span>
        </div>
      )}
    </div>
  );
}

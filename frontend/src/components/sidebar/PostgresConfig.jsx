import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, AlertCircle } from 'lucide-react';
import { SelectField, TextField, CodeEditor } from '../forms';
import API from '../../api/client';
import NodeValidator from '../../validators/NodeValidator';
import { NodeTypes } from '../../constants/NodeTypes';

const OPERATION_OPTIONS = [
  { value: 'select', label: 'Select' },
  { value: 'insert', label: 'Insert' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'query', label: 'Raw SQL' },
];

export default function PostgresConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const pgConns = all.filter((c) =>
          c.status === 'active' && (c.provider === 'postgres' || c.provider === 'postgresql')
        );
        setConnections(pgConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const operation = data.operation || 'select';
  const validation = NodeValidator.validateNode({ type: NodeTypes.ACTION_POSTGRES, data });

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
            <Link2 size={11} /> Connection
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
              <span>No active PostgreSQL connections</span>
            </div>
            <div>
              Create a PostgreSQL connection in <a href="/connections" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Connections</a> to query your database.
            </div>
          </div>
        ) : (
          <select
            id="pg-connection-select"
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
          >
            <option value="">Select a connection…</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.email || c.metadata?.database || 'PostgreSQL'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Operation selector */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATION_OPTIONS}
      />

      {/* Operation-specific fields */}
      {operation === 'query' ? (
        <>
          <CodeEditor
            label="Raw SQL Query"
            placeholder="SELECT * FROM users WHERE email = {{trigger.body.email}}"
            value={data.query || data.sql || ''}
            onChange={(val) => updateField('query', val)}
            onInsertVariable={() => handleInsertVar('query')}
            minHeight={110}
            helperText="Parameters are automatically bound for dynamic {{expressions}} to prevent SQL injection."
          />
          <TextField
            label="Parameters (Optional JSON Array)"
            placeholder='["{{prev.id}}", "active"]'
            value={typeof data.params === 'object' ? JSON.stringify(data.params) : (data.params || '')}
            onChange={(val) => updateField('params', val)}
            onInsertVariable={() => handleInsertVar('params')}
            helperText="Optional JSON array of parameters bound to $1, $2, etc."
          />
        </>
      ) : (
        <>
          <TextField
            label="Table Name"
            placeholder="users"
            value={data.table || ''}
            onChange={(val) => updateField('table', val)}
            onInsertVariable={() => handleInsertVar('table')}
          />

          {operation === 'select' && (
            <>
              <TextField
                label="Columns"
                placeholder="* or id, name, email"
                value={data.columns || ''}
                onChange={(val) => updateField('columns', val)}
                helperText="Comma-separated column names or * for all columns"
              />
              <CodeEditor
                label="Filters / WHERE (JSON)"
                placeholder='{"status": "active", "org_id": "{{prev.orgId}}"}'
                value={typeof data.filters === 'object' ? JSON.stringify(data.filters, null, 2) : (data.filters || '')}
                onChange={(val) => updateField('filters', val)}
                onInsertVariable={() => handleInsertVar('filters')}
                minHeight={80}
              />
              <TextField
                label="Limit"
                placeholder="10"
                value={data.limit !== undefined ? String(data.limit) : '10'}
                onChange={(val) => updateField('limit', val)}
              />
            </>
          )}

          {operation === 'insert' && (
            <CodeEditor
              label="Values / Data (JSON)"
              placeholder='{"name": "Alice", "email": "{{trigger.body.email}}"}'
              value={typeof data.values === 'object' ? JSON.stringify(data.values, null, 2) : (data.values || '')}
              onChange={(val) => updateField('values', val)}
              onInsertVariable={() => handleInsertVar('values')}
              minHeight={100}
              helperText="Field-value mapping for the new row"
            />
          )}

          {operation === 'update' && (
            <>
              <CodeEditor
                label="Update Values (JSON)"
                placeholder='{"status": "verified", "updated_at": "NOW()"}'
                value={typeof data.values === 'object' ? JSON.stringify(data.values, null, 2) : (data.values || '')}
                onChange={(val) => updateField('values', val)}
                onInsertVariable={() => handleInsertVar('values')}
                minHeight={90}
                helperText="Fields to update"
              />
              <CodeEditor
                label="Filters / WHERE (JSON)"
                placeholder='{"id": "{{prev.userId}}"}'
                value={typeof data.filters === 'object' ? JSON.stringify(data.filters, null, 2) : (data.filters || '')}
                onChange={(val) => updateField('filters', val)}
                onInsertVariable={() => handleInsertVar('filters')}
                minHeight={80}
                helperText="Condition for updating records"
              />
            </>
          )}

          {operation === 'delete' && (
            <CodeEditor
              label="Filters / WHERE (JSON)"
              placeholder='{"id": "{{prev.userId}}"}'
              value={typeof data.filters === 'object' ? JSON.stringify(data.filters, null, 2) : (data.filters || '')}
              onChange={(val) => updateField('filters', val)}
              onInsertVariable={() => handleInsertVar('filters')}
              minHeight={80}
              helperText="Condition for records to delete"
            />
          )}
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

import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, AlertCircle } from 'lucide-react';
import { SelectField, TextField, CodeEditor } from '../forms';
import API from '../../api/client';
import NodeValidator from '../../validators/NodeValidator';
import { NodeTypes } from '../../constants/NodeTypes';

const OPERATION_OPTIONS = [
  { value: 'find', label: 'Find' },
  { value: 'findOne', label: 'Find One' },
  { value: 'insertOne', label: 'Insert One' },
  { value: 'insertMany', label: 'Insert Many' },
  { value: 'updateOne', label: 'Update One' },
  { value: 'deleteOne', label: 'Delete One' },
  { value: 'count', label: 'Count' },
];

export default function MongoConfig({ data, onChange, onOpenVariablePicker }) {
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const mongoConns = all.filter((c) =>
          c.status === 'active' && c.provider === 'mongodb'
        );
        setConnections(mongoConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const operation = data.operation || 'find';
  const validation = NodeValidator.validateNode({ type: NodeTypes.ACTION_MONGODB, data });

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
              <span>No active MongoDB connections</span>
            </div>
            <div>
              Create a MongoDB connection in <a href="/connections" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Connections</a> to query your database.
            </div>
          </div>
        ) : (
          <select
            id="mongo-connection-select"
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
            value={data.connectionId || ''}
            onChange={(e) => updateField('connectionId', e.target.value)}
          >
            <option value="">Select a connection…</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.email || c.metadata?.database || 'MongoDB'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Database & Collection */}
      <TextField
        label="Database (Optional Override)"
        placeholder="Defaults to connection database"
        value={data.database || ''}
        onChange={(val) => updateField('database', val)}
        onInsertVariable={() => handleInsertVar('database')}
      />

      <TextField
        label="Collection"
        placeholder="orders"
        value={data.collection || ''}
        onChange={(val) => updateField('collection', val)}
        onInsertVariable={() => handleInsertVar('collection')}
      />

      {/* Operation selector */}
      <SelectField
        label="Operation"
        value={operation}
        onChange={(val) => updateField('operation', val)}
        options={OPERATION_OPTIONS}
      />

      {/* Operation-specific fields */}
      {(operation === 'find' || operation === 'findOne' || operation === 'count') && (
        <CodeEditor
          label="Filter (JSON Query)"
          placeholder='{"status": "active", "userId": "{{prev.id}}"}'
          value={typeof data.filter === 'object' ? JSON.stringify(data.filter, null, 2) : (data.filter || '')}
          onChange={(val) => updateField('filter', val)}
          onInsertVariable={() => handleInsertVar('filter')}
          minHeight={80}
          helperText="MongoDB query document. Supports variable substitution."
        />
      )}

      {operation === 'find' && (
        <>
          <TextField
            label="Limit"
            placeholder="50"
            value={data.limit !== undefined ? String(data.limit) : '50'}
            onChange={(val) => updateField('limit', val)}
          />
          <TextField
            label="Sort (Optional JSON)"
            placeholder='{"createdAt": -1}'
            value={typeof data.sort === 'object' ? JSON.stringify(data.sort) : (data.sort || '')}
            onChange={(val) => updateField('sort', val)}
            helperText="Sort order for matching documents"
          />
        </>
      )}

      {operation === 'insertOne' && (
        <CodeEditor
          label="Document (JSON)"
          placeholder='{"name": "Widget", "price": 29.99, "owner": "{{prev.userId}}"}'
          value={typeof data.document === 'object' ? JSON.stringify(data.document, null, 2) : (data.document || data.data || '')}
          onChange={(val) => updateField('document', val)}
          onInsertVariable={() => handleInsertVar('document')}
          minHeight={100}
          helperText="Document to insert into collection"
        />
      )}

      {operation === 'insertMany' && (
        <CodeEditor
          label="Documents Array (JSON)"
          placeholder='[{"item": "A"}, {"item": "B"}]'
          value={typeof data.document === 'object' ? JSON.stringify(data.document, null, 2) : (data.document || data.data || '')}
          onChange={(val) => updateField('document', val)}
          onInsertVariable={() => handleInsertVar('document')}
          minHeight={100}
          helperText="JSON array of documents to insert"
        />
      )}

      {operation === 'updateOne' && (
        <>
          <CodeEditor
            label="Filter (JSON Query)"
            placeholder='{"_id": "{{prev.id}}"}'
            value={typeof data.filter === 'object' ? JSON.stringify(data.filter, null, 2) : (data.filter || '')}
            onChange={(val) => updateField('filter', val)}
            onInsertVariable={() => handleInsertVar('filter')}
            minHeight={70}
            helperText="Identifies the document to update"
          />
          <CodeEditor
            label="Update Data (JSON)"
            placeholder='{"status": "completed", "updatedAt": "{{steps.date_1.data}}"}'
            value={typeof data.update === 'object' ? JSON.stringify(data.update, null, 2) : (data.update || data.document || '')}
            onChange={(val) => updateField('update', val)}
            onInsertVariable={() => handleInsertVar('update')}
            minHeight={80}
            helperText="Update fields (automatically wrapped in $set if not specified)"
          />
        </>
      )}

      {operation === 'deleteOne' && (
        <CodeEditor
          label="Filter (JSON Query)"
          placeholder='{"_id": "{{prev.id}}"}'
          value={typeof data.filter === 'object' ? JSON.stringify(data.filter, null, 2) : (data.filter || '')}
          onChange={(val) => updateField('filter', val)}
          onInsertVariable={() => handleInsertVar('filter')}
          minHeight={80}
          helperText="Identifies the single document to delete"
        />
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

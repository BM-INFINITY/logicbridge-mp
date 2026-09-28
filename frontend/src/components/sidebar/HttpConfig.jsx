import React, { useState, useEffect } from 'react';
import { RefreshCw, Link2 } from 'lucide-react';
import { TextField, SelectField, KeyValueTable, CodeEditor, NumberField } from '../forms';
import API from '../../api/client';

export default function HttpConfig({ data, onChange, onOpenVariablePicker }) {
  const [activeTab, setActiveTab] = useState('request');
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);

  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const queryParams = data.queryParamsList || [];
  const headers = data.headersList || [];
  const formDataList = data.formDataList || [];

  const fetchConnections = () => {
    setLoadingConns(true);
    API.get('/api/connections')
      .then(({ data: res }) => {
        const all = res.data || res;
        const apiConns = all.filter((c) => c.status === 'active' && ['http', 'api'].includes(c.provider));
        setConnections(apiConns);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConns(false));
  };

  useEffect(() => {
    if (data.authType === 'connection') {
      fetchConnections();
    }
  }, [data.authType]);

  const handleQueryChange = (idx, field, val) => {
    const updated = [...queryParams];
    updated[idx] = { ...updated[idx], [field]: val };
    updateField('queryParamsList', updated);
  };
  const handleAddQuery = () => updateField('queryParamsList', [...queryParams, { key: '', value: '' }]);
  const handleRemoveQuery = (idx) => updateField('queryParamsList', queryParams.filter((_, i) => i !== idx));

  const handleHeaderChange = (idx, field, val) => {
    const updated = [...headers];
    updated[idx] = { ...updated[idx], [field]: val };
    updateField('headersList', updated);
  };
  const handleAddHeader = () => updateField('headersList', [...headers, { key: '', value: '' }]);
  const handleRemoveHeader = (idx) => updateField('headersList', headers.filter((_, i) => i !== idx));

  const handleFormDataChange = (idx, field, val) => {
    const updated = [...formDataList];
    updated[idx] = { ...updated[idx], [field]: val };
    updateField('formDataList', updated);
  };
  const handleAddFormData = () => updateField('formDataList', [...formDataList, { key: '', value: '' }]);
  const handleRemoveFormData = (idx) => updateField('formDataList', formDataList.filter((_, i) => i !== idx));

  const sectionTabs = [
    { id: 'request', label: 'Request' },
    { id: 'auth', label: 'Auth' },
    { id: 'body', label: 'Body' },
    { id: 'advanced', label: 'Advanced' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Internal Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 3, borderRadius: 'var(--radius-sm)' }}>
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '5px 2px',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 1. Request Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'request' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SelectField
            label="HTTP Method"
            value={data.method || 'GET'}
            onChange={(val) => updateField('method', val)}
            options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']}
          />

          <TextField
            label="URL Endpoint"
            placeholder="https://api.example.com/data or {{steps.n1.data.url}}"
            value={data.url}
            onChange={(val) => updateField('url', val)}
            onInsertVariable={() => onOpenVariablePicker('url')}
          />

          <KeyValueTable
            title="Query Parameters"
            items={queryParams}
            onAdd={handleAddQuery}
            onUpdate={handleQueryChange}
            onRemove={handleRemoveQuery}
            onInsertValueVariable={(idx) => onOpenVariablePicker(`queryParamsList[${idx}].value`)}
            keyPlaceholder="param"
            valuePlaceholder="value"
          />

          <KeyValueTable
            title="Headers"
            items={headers}
            onAdd={handleAddHeader}
            onUpdate={handleHeaderChange}
            onRemove={handleRemoveHeader}
            onInsertValueVariable={(idx) => onOpenVariablePicker(`headersList[${idx}].value`)}
            keyPlaceholder="Header-Name"
            valuePlaceholder="Header-Value"
          />
        </div>
      )}

      {/* ── 2. Auth Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'auth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SelectField
            label="Authentication Mode"
            value={data.authType || 'none'}
            onChange={(val) => updateField('authType', val)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'bearer', label: 'Bearer Token' },
              { value: 'api_key', label: 'API Key' },
              { value: 'basic', label: 'Basic Auth' },
              { value: 'connection', label: 'Saved Connection' },
            ]}
          />

          {data.authType === 'bearer' && (
            <TextField
              label="Bearer Token"
              placeholder="eyJhbGciOi..."
              value={data.authToken || ''}
              onChange={(val) => updateField('authToken', val)}
              onInsertVariable={() => onOpenVariablePicker('authToken')}
            />
          )}

          {data.authType === 'api_key' && (
            <>
              <TextField
                label="Key Name"
                placeholder="X-API-Key or api_key"
                value={data.apiKey || ''}
                onChange={(val) => updateField('apiKey', val)}
                onInsertVariable={() => onOpenVariablePicker('apiKey')}
              />
              <TextField
                label="Key Value"
                placeholder="secret_key_123"
                value={data.apiValue || ''}
                onChange={(val) => updateField('apiValue', val)}
                onInsertVariable={() => onOpenVariablePicker('apiValue')}
              />
              <SelectField
                label="Key Location"
                value={data.apiLocation || 'header'}
                onChange={(val) => updateField('apiLocation', val)}
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query Parameter' },
                ]}
              />
            </>
          )}

          {data.authType === 'basic' && (
            <>
              <TextField
                label="Username"
                placeholder="admin"
                value={data.authUsername || ''}
                onChange={(val) => updateField('authUsername', val)}
                onInsertVariable={() => onOpenVariablePicker('authUsername')}
              />
              <TextField
                label="Password"
                placeholder="••••••••"
                value={data.authPassword || ''}
                onChange={(val) => updateField('authPassword', val)}
                onInsertVariable={() => onOpenVariablePicker('authPassword')}
              />
            </>
          )}

          {data.authType === 'connection' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Link2 size={11} /> Saved Connection
                </label>
                <button
                  type="button"
                  onClick={fetchConnections}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  <RefreshCw size={11} style={{ animation: loadingConns ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>

              {connections.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  No active HTTP/API connections.{' '}
                  <a href="/connections" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                    Add a connection
                  </a>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={data.connectionId || ''}
                  onChange={(e) => updateField('connectionId', e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="">— Select Saved Connection —</option>
                  {connections.map((c) => (
                    <option key={c._id} value={c._id}>
                      🌐 {c.name} ({c.email || c.provider})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 3. Body Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'body' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['GET', 'HEAD', 'OPTIONS'].includes((data.method || 'GET').toUpperCase()) ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
              Request body is not sent for {data.method || 'GET'} requests.
            </div>
          ) : (
            <>
              <SelectField
                label="Content Type"
                value={data.contentType || 'json'}
                onChange={(val) => updateField('contentType', val)}
                options={[
                  { value: 'json', label: 'JSON (application/json)' },
                  { value: 'text', label: 'Text (text/plain)' },
                  { value: 'form-data', label: 'Form Data (x-www-form-urlencoded)' },
                  { value: 'multipart', label: 'Multipart (multipart/form-data)' },
                ]}
              />

              {['json', 'text'].includes(data.contentType || 'json') && (
                <CodeEditor
                  label="Body Template"
                  placeholder={data.contentType === 'text' ? 'Raw body text...' : '{\n  "key": "{{steps.n1.data.val}}"\n}'}
                  value={data.body || ''}
                  onChange={(val) => updateField('body', val)}
                  onInsertVariable={() => onOpenVariablePicker('body')}
                  minHeight={130}
                />
              )}

              {['form-data', 'multipart'].includes(data.contentType) && (
                <KeyValueTable
                  title="Form Key-Value Pairs"
                  items={formDataList}
                  onAdd={handleAddFormData}
                  onUpdate={handleFormDataChange}
                  onRemove={handleRemoveFormData}
                  onInsertValueVariable={(idx) => onOpenVariablePicker(`formDataList[${idx}].value`)}
                  keyPlaceholder="field_name"
                  valuePlaceholder="field_value"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── 4. Advanced Tab ────────────────────────────────────────────────── */}
      {activeTab === 'advanced' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NumberField
            label="Timeout (ms)"
            value={data.timeout ?? 15000}
            onChange={(val) => updateField('timeout', val)}
            min={100}
            max={300000}
            step={1000}
            helperText="Range: 100ms - 300,000ms (5 mins)"
          />

          <NumberField
            label="Retry Attempts (0-5)"
            value={data.retries ?? 0}
            onChange={(val) => updateField('retries', val)}
            min={0}
            max={5}
            helperText="Number of retry attempts on 5xx or network errors"
          />

          {Number(data.retries || 0) > 0 && (
            <>
              <NumberField
                label="Retry Delay (ms)"
                value={data.retryDelay ?? 1000}
                onChange={(val) => updateField('retryDelay', val)}
                min={100}
                max={60000}
                step={500}
              />

              <SelectField
                label="Backoff Strategy"
                value={data.backoffStrategy || 'fixed'}
                onChange={(val) => updateField('backoffStrategy', val)}
                options={[
                  { value: 'fixed', label: 'Fixed Delay' },
                  { value: 'exponential', label: 'Exponential Backoff' },
                ]}
              />
            </>
          )}

          <SelectField
            label="Explicit Response Parsing"
            value={data.responseType || 'auto'}
            onChange={(val) => updateField('responseType', val)}
            options={[
              { value: 'auto', label: 'Auto Detect (Default)' },
              { value: 'json', label: 'Enforce JSON' },
              { value: 'text', label: 'Enforce Text' },
            ]}
          />
        </div>
      )}
    </div>
  );
}

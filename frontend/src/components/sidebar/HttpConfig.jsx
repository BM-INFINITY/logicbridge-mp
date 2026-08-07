import React from 'react';
import { TextField, SelectField, KeyValueTable, CodeEditor } from '../forms';

export default function HttpConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  const queryParams = data.queryParamsList || [];
  const headers = data.headersList || [];

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField
        label="URL"
        placeholder="https://script.google.com/... or https://api.imd.gov.in/..."
        value={data.url}
        onChange={(val) => updateField('url', val)}
        onInsertVariable={() => onOpenVariablePicker('url')}
      />

      <SelectField
        label="Method"
        value={data.method || 'GET'}
        onChange={(val) => updateField('method', val)}
        options={['GET', 'POST', 'PUT', 'DELETE']}
      />

      <KeyValueTable
        title="Query Parameters"
        items={queryParams}
        onAdd={handleAddQuery}
        onUpdate={handleQueryChange}
        onRemove={handleRemoveQuery}
        keyPlaceholder="param"
        valuePlaceholder="value"
      />

      <KeyValueTable
        title="Headers"
        items={headers}
        onAdd={handleAddHeader}
        onUpdate={handleHeaderChange}
        onRemove={handleRemoveHeader}
        keyPlaceholder="Header-Name"
        valuePlaceholder="Header-Value"
      />

      {data.method !== 'GET' && (
        <CodeEditor
          label="Request Body (JSON)"
          placeholder='{"key": "value"}'
          value={data.body}
          onChange={(val) => updateField('body', val)}
          onInsertVariable={() => onOpenVariablePicker('body')}
        />
      )}
    </div>
  );
}

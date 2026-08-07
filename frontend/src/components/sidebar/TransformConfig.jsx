import React from 'react';
import { CodeEditor } from '../forms';

export default function TransformConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CodeEditor
        label="Field Mapping (JSON Template)"
        placeholder='{"name": "{{prev.name}}", "email": "{{prev.email}}"}'
        value={data.template}
        onChange={(val) => updateField('template', val)}
        onInsertVariable={() => onOpenVariablePicker('template')}
        minHeight={140}
        helperText="Use handlebar placeholders like {{prev.field}} to extract upstream data"
      />
    </div>
  );
}

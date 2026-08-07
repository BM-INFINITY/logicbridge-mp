import React from 'react';
import { TextField, SelectField } from '../forms';

export default function ConditionConfig({ data, onChange, onOpenVariablePicker }) {
  const updateField = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField
        label="Left Value (or {{prev.field}})"
        placeholder="{{prev.status}}"
        value={data.leftValue}
        onChange={(val) => updateField('leftValue', val)}
        onInsertVariable={() => onOpenVariablePicker('leftValue')}
      />

      <SelectField
        label="Operator"
        value={data.operator || 'equals'}
        onChange={(val) => updateField('operator', val)}
        options={[
          { label: 'Equals (=)', value: 'equals' },
          { label: 'Not Equals (!=)', value: 'not-equals' },
          { label: 'Contains', value: 'contains' },
          { label: 'Greater Than (>)', value: 'greater-than' },
          { label: 'Less Than (<)', value: 'less-than' },
        ]}
      />

      <TextField
        label="Right Value"
        placeholder="active or 200"
        value={data.rightValue}
        onChange={(val) => updateField('rightValue', val)}
        onInsertVariable={() => onOpenVariablePicker('rightValue')}
      />
    </div>
  );
}

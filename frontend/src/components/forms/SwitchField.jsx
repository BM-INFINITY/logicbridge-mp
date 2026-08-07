import React from 'react';

export default function SwitchField({ label, value, onChange, helperText }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select
        className="form-input"
        style={{ fontSize: '0.8rem', padding: '7px 10px' }}
        value={String(value ?? 'true')}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">Enabled / Yes</option>
        <option value="false">Disabled / No</option>
      </select>
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

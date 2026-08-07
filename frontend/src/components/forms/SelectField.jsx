import React from 'react';

export default function SelectField({ label, value, onChange, options = [], helperText }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select
        className="form-input"
        style={{ fontSize: '0.8rem', padding: '7px 10px' }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

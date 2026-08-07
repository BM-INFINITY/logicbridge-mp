import React from 'react';

export default function NumberField({ label, value, onChange, min = 0, max, step = 1, helperText }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input
        type="number"
        className="form-input"
        style={{ fontSize: '0.8rem', padding: '7px 10px' }}
        min={min}
        max={max}
        step={step}
        value={value ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {helperText && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

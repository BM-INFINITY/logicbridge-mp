import React from 'react';
import { Play } from 'lucide-react';

export default function TestPanel({ onTest, testing, testResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        Test this step independently with upstream context data.
      </p>

      <button
        id="test-step-btn"
        className="btn btn-primary w-full"
        style={{ fontSize: '0.83rem', padding: '9px' }}
        onClick={onTest}
        disabled={testing}
      >
        {testing ? <><span className="spinner" /> Testing Step...</> : <><Play size={14} /> Test Step</>}
      </button>

      {testResult && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            Test Response Payload:
          </div>
          <pre
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              fontSize: '0.73rem',
              color: 'var(--accent-secondary)',
              maxHeight: 220,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

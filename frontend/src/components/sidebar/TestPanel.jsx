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
          {/* Agent Tool Call Sequence View */}
          {testResult?.output?.toolCalls && Array.isArray(testResult.output.toolCalls) && testResult.output.toolCalls.length > 0 && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(139, 92, 246, 0.08)', borderRadius: 8, border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a78bfa', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>Agent Tool Calls Trace</span>
                <span>{testResult.output.totalToolCalls || testResult.output.toolCalls.length} calls</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {testResult.output.toolCalls.map((tc, idx) => (
                  <div
                    key={tc.id || idx}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 6,
                      fontSize: '0.72rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idx + 1}. {tc.tool}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: tc.status === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: tc.status === 'success' ? '#4ade80' : '#f87171',
                        }}
                      >
                        {tc.status} ({tc.durationMs}ms)
                      </span>
                    </div>
                    {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                        args: {JSON.stringify(tc.arguments)}
                      </div>
                    )}
                    {tc.error && (
                      <div style={{ color: '#f87171', fontSize: '0.68rem', marginTop: 2 }}>
                        Error: {tc.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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

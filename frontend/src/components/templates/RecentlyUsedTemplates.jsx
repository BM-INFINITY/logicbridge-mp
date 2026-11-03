import React from 'react';
import { Clock, ArrowRight, Trash2 } from 'lucide-react';

export default function RecentlyUsedTemplates({
  recentTemplates = [],
  onUseTemplate,
  onClearRecents,
}) {
  if (!recentTemplates || recentTemplates.length === 0) {
    return null;
  }

  return (
    <div
      id="recently-used-templates-bar"
      style={{
        background: 'rgba(108,99,255,0.06)',
        border: '1px solid rgba(108,99,255,0.18)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)',
          letterSpacing: '0.02em',
        }}>
          <Clock size={13} /> Recently Used:
        </span>

        {recentTemplates.map((item) => (
          <button
            key={item.id}
            id={`recent-template-chip-${item.id}`}
            type="button"
            onClick={() => onUseTemplate(item)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 14,
              fontSize: '0.74rem', fontWeight: 500,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            title={`Instantiate "${item.name}"`}
          >
            {item.name}
            <ArrowRight size={10} style={{ opacity: 0.7 }} />
          </button>
        ))}
      </div>

      {onClearRecents && (
        <button
          type="button"
          onClick={onClearRecents}
          style={{
            background: 'none', border: 'none',
            fontSize: '0.7rem', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 6px',
          }}
          title="Clear recently used templates history"
        >
          <Trash2 size={11} /> Clear
        </button>
      )}
    </div>
  );
}


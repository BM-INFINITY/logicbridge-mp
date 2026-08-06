import React from 'react';
import { TEMPLATES } from '../data/templates';
import { X, Zap } from 'lucide-react';

export default function TemplatesModal({ onClose, onLoad }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700 }}>Workflow Templates</h2>
            <p className="text-secondary text-sm" style={{ marginTop: 2 }}>Load a ready-to-run workflow and see real results instantly</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TEMPLATES.map(t => (
            <div key={t.id} onClick={() => { onLoad(t); onClose(); }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{t.description}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {t.nodes.map(n => (
                  <span key={n.id} style={{ fontSize: '0.65rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-secondary)' }}>
                    {n.data.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

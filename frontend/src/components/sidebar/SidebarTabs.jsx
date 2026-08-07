import React from 'react';
import { Sliders, Play, FileText } from 'lucide-react';

export default function SidebarTabs({ activeTab, onChangeTab }) {
  const tabs = [
    { id: 'config', label: 'Configuration', icon: <Sliders size={13} /> },
    { id: 'testing', label: 'Testing', icon: <Play size={13} /> },
    { id: 'docs', label: 'Documentation', icon: <FileText size={13} /> },
  ];

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              background: isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.78rem',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: 6,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
}

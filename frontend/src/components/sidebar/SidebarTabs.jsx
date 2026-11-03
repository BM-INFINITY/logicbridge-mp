import React from 'react';
import { Sliders, Play, FileText } from 'lucide-react';

export default function SidebarTabs({ activeTab, onChangeTab }) {
  const tabs = [
    { id: 'config', label: 'Configuration', shortLabel: 'Config', icon: <Sliders size={13} /> },
    { id: 'testing', label: 'Testing', shortLabel: 'Testing', icon: <Play size={13} /> },
    { id: 'docs', label: 'Docs', shortLabel: 'Docs', icon: <FileText size={13} /> },
  ];

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        minWidth: 0,
      }}
      role="tablist"
      aria-label="Sidebar Sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChangeTab(tab.id)}
            style={{
              flex: 1,
              minWidth: 'fit-content',
              padding: '10px 8px',
              border: 'none',
              background: isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.78rem',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            title={tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

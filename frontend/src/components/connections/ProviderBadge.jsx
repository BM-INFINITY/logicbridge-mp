import React from 'react';

const PROVIDER_COLORS = {
  smtp:    { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' },
  gmail:   { bg: 'rgba(234,67,53,0.15)',  color: '#ea4335' },
  outlook: { bg: 'rgba(0,120,212,0.15)',  color: '#0078d4' },
};

const PROVIDER_ICONS = {
  smtp:    '📧',
  gmail:   '📩',
  outlook: '📬',
};

/**
 * ProviderBadge — small pill showing provider identity with icon.
 */
export default function ProviderBadge({ provider, size = 'sm' }) {
  const style = PROVIDER_COLORS[provider] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' };
  const icon  = PROVIDER_ICONS[provider] || '🔌';
  const label = provider?.toUpperCase() || 'UNKNOWN';

  const fontSize = size === 'lg' ? '0.8rem' : '0.68rem';
  const padding  = size === 'lg' ? '4px 10px' : '2px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: style.bg,
        color: style.color,
        borderRadius: 'var(--radius-full)',
        fontSize,
        fontWeight: 600,
        padding,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        border: `1px solid ${style.color}30`,
      }}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}

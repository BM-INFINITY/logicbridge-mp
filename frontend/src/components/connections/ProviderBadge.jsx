import React from 'react';
import { getProviderIcon } from '../../constants/Icons';

const PROVIDER_COLORS = {
  smtp:          { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' },
  gmail:         { bg: 'rgba(234,67,53,0.15)',  color: '#ea4335' },
  outlook:       { bg: 'rgba(0,120,212,0.15)',  color: '#0078d4' },
  postgres:      { bg: 'rgba(51,103,145,0.15)', color: '#336791' },
  mongodb:       { bg: 'rgba(0,237,100,0.15)',  color: '#00ed64' },
  google_sheets: { bg: 'rgba(15,157,88,0.15)',  color: '#0f9d58' },
};

/**
 * ProviderBadge — small pill showing provider identity with icon.
 */
export default function ProviderBadge({ provider, size = 'sm' }) {
  const style    = PROVIDER_COLORS[provider] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' };
  const label    = provider?.toUpperCase() || 'UNKNOWN';
  const IconComp = getProviderIcon(provider);

  const fontSize   = size === 'lg' ? '0.8rem' : '0.68rem';
  const padding    = size === 'lg' ? '4px 10px' : '2px 8px';
  const iconSize   = size === 'lg' ? 14 : 11;

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
      <IconComp size={iconSize} />
      {label}
    </span>
  );
}

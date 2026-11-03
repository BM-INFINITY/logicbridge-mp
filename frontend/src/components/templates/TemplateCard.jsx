import React, { useState } from 'react';
import { getNodeIcon } from '../../constants/Icons';
import {
  Star, Eye, ArrowRight, Database, Table, Mail, Sparkles, Layers,
  Globe, Shuffle, GitBranch, Zap, FileText, Braces, Code2, Settings,
  Clock, Type, Calculator, Calendar, Filter, Tag,
} from 'lucide-react';

const ICON_MAP = {
  Globe, Shuffle, GitBranch, Database, Table, Zap, FileText,
  Braces, Code2, Layers, Star, Settings,
  Mail, Clock, Type, Calculator, Calendar, Sparkles, Filter, Tag,
};

function TemplateIcon({ name, size = 20 }) {
  const Icon = ICON_MAP[name] || Layers;
  return <Icon size={size} />;
}

const DIFFICULTY_STYLE = {
  Beginner:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  Advanced:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
};

function DifficultyBadge({ difficulty }) {
  const s = DIFFICULTY_STYLE[difficulty] || DIFFICULTY_STYLE.Beginner;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em',
      padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {difficulty}
    </span>
  );
}

function ConnectionRequirementBadge({ requiresConnection }) {
  if (!requiresConnection) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.65rem', fontWeight: 600,
          padding: '2px 8px', borderRadius: 20,
          background: 'rgba(34,197,94,0.1)', color: '#22c55e',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
        title="Zero external credentials needed — executes immediately out of the box"
      >
        <Sparkles size={10} /> Ready to Run
      </span>
    );
  }

  const CONFIG = {
    postgres:      { label: 'PostgreSQL', icon: Database, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
    mongodb:       { label: 'MongoDB',    icon: Database, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    google_sheets: { label: 'Sheets',     icon: Table,    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)' },
    email:         { label: 'Email/SMTP', icon: Mail,     color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  };

  const c = CONFIG[requiresConnection] || { label: 'Connection Required', icon: Layers, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  const ReqIcon = c.icon;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.65rem', fontWeight: 600,
        padding: '2px 8px', borderRadius: 20,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      }}
      title={`Requires active ${c.label} connection`}
    >
      <ReqIcon size={10} /> {c.label}
    </span>
  );
}

function NodeTypeChip({ type }) {
  const IconComp = getNodeIcon(type);
  const label = type.replace('action-', '').replace('trigger-', '').replace('logic-', '');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.62rem', fontWeight: 500,
      padding: '2px 7px', borderRadius: 6,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
    }}>
      <IconComp size={10} />
      {label}
    </span>
  );
}

export default function TemplateCard({
  template,
  onUse,
  onPreview,
  isFavorite,
  onToggleFavorite,
}) {
  const [hovered, setHovered] = useState(false);

  const displayedTypes = template.nodeTypes?.slice(0, 4) || [];
  const extraCount = (template.nodeTypes?.length || 0) - displayedTypes.length;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'default',
        transition: 'border-color var(--transition), box-shadow var(--transition), transform var(--transition)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(108,99,255,0.15)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar on hover */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'var(--accent-gradient)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity var(--transition)',
      }} />

      {/* Header: icon + name + badges + favorite */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(108,99,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-primary)',
          border: '1px solid rgba(108,99,255,0.2)',
        }}>
          <TemplateIcon name={template.icon} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 5, lineHeight: 1.3 }}>
            {template.name}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {template.difficulty && <DifficultyBadge difficulty={template.difficulty} />}
            <ConnectionRequirementBadge requiresConnection={template.requiresConnection} />
          </div>
        </div>

        {/* Favorite toggle star */}
        <button
          id={`favorite-btn-${template.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(template.id);
          }}
          title={isFavorite ? `Remove "${template.name}" from favorites` : `Add "${template.name}" to favorites`}
          aria-label={isFavorite ? `Remove ${template.name} from favorites` : `Add ${template.name} to favorites`}
          aria-pressed={isFavorite}
          style={{
            background: isFavorite ? 'rgba(245,158,11,0.15)' : 'var(--bg-elevated)',
            border: `1px solid ${isFavorite ? '#f59e0b' : 'var(--border)'}`,
            borderRadius: 8,
            padding: 7,
            cursor: 'pointer',
            color: isFavorite ? '#f59e0b' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            width: 32,
            height: 32,
          }}
        >
          <Star size={15} fill={isFavorite ? '#f59e0b' : 'none'} color={isFavorite ? '#f59e0b' : 'currentColor'} />
        </button>
      </div>

      {/* Description & Use Case */}
      <p style={{
        fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55,
        margin: 0, flexGrow: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {template.useCase || template.description}
      </p>

      {/* Node types used */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {displayedTypes.map((t) => <NodeTypeChip key={t} type={t} />)}
        {extraCount > 0 && (
          <span style={{
            fontSize: '0.62rem', padding: '2px 7px', borderRadius: 6,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}>
            +{extraCount} more
          </span>
        )}
      </div>

      {/* Footer: Node counts + Preview + Use Template */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {template.nodes?.length || 0} nodes · {template.edges?.length || 0} edges
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onPreview && (
            <button
              id={`preview-template-${template.id}`}
              type="button"
              onClick={() => onPreview(template)}
              title="Preview workflow details"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem', fontWeight: 500, padding: '6px 10px',
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <Eye size={13} /> Preview
            </button>
          )}

          <button
            id={`use-template-${template.id}`}
            type="button"
            onClick={() => onUse(template)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: hovered ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              color: hovered ? '#fff' : 'var(--text-primary)',
              fontSize: '0.78rem', fontWeight: 600, padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
          >
            Use Template <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}


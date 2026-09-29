/**
 * TemplatesModal — full-page templates browser with search, category filtering,
 * template cards, and the "Use Template" flow.
 *
 * Opens as a full-page overlay (not a small modal) so templates have
 * the space they deserve as a proper product page.
 */

import React, { useState, useMemo } from 'react';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import { getNodeIcon } from '../constants/Icons';
import {
  X, Search, Layers, Code2, Star,
  ArrowRight, Globe, Shuffle, GitBranch, Database, Table,
  Zap, FileText, Braces, Settings,
} from 'lucide-react';

// ─── Icon lookup by string name ───────────────────────────────────────────────
// Used to resolve the `icon` string field in template metadata to a component.
const ICON_MAP = {
  Globe, Shuffle, GitBranch, Database, Table, Zap, FileText,
  Braces, Code2, Layers, Star, Settings,
};

function resolveIcon(name) {
  return ICON_MAP[name] || Layers;
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────
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

// ─── Node type chips ──────────────────────────────────────────────────────────
function NodeTypeChip({ type }) {
  const IconComp = getNodeIcon(type);
  // Truncate long type names for display
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

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onUse }) {
  const [hovered, setHovered] = useState(false);
  const IconComp = resolveIcon(template.icon);

  // Limit displayed node types to 4 to keep cards compact
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
      {/* Subtle top gradient bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'var(--accent-gradient)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity var(--transition)',
      }} />

      {/* Header: icon + name + difficulty */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(108,99,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-primary)',
          border: '1px solid rgba(108,99,255,0.2)',
        }}>
          <IconComp size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4, lineHeight: 1.3 }}>
            {template.name}
          </div>
          {template.difficulty && <DifficultyBadge difficulty={template.difficulty} />}
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55,
        margin: 0, flexGrow: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {template.description}
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

      {/* Footer: node count + Use Template */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {template.nodes?.length || 0} nodes · {template.edges?.length || 0} connections
        </span>
        <button
          id={`use-template-${template.id}`}
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
  );
}

// ─── Category Filter ──────────────────────────────────────────────────────────
function CategoryFilter({ categories, active, onChange, templateCounts }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
    }}>
      {categories.map((cat) => {
        const count = templateCounts[cat.id] ?? 0;
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 14px', borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem', fontWeight: isActive ? 600 : 500,
              background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all var(--transition)',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.label}
            <span style={{
              fontSize: '0.65rem', background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
              borderRadius: 10, padding: '1px 6px',
              color: isActive ? '#fff' : 'var(--text-muted)',
            }}>
              {cat.id === 'all' ? TEMPLATES.length : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main TemplatesModal ──────────────────────────────────────────────────────
export default function TemplatesModal({ onClose, onLoad }) {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('all');

  // Per-category counts for filter pills
  const templateCounts = useMemo(() => {
    const counts = {};
    TEMPLATE_CATEGORIES.forEach((cat) => {
      counts[cat.id] = TEMPLATES.filter((t) => t.category === cat.id).length;
    });
    return counts;
  }, []);

  // Filtered templates
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return TEMPLATES.filter((t) => {
      const catMatch = category === 'all' || t.category === category;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [search, category]);

  const handleUse = (template) => {
    onLoad(template);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1060,
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          minHeight: 'min(90vh, 700px)',
          maxHeight: '90vh',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
                Workflow Templates
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Pick a ready-to-run workflow. Click <strong>Use Template</strong> to load it into the builder.
              </p>
            </div>
            <button
              id="templates-modal-close"
              onClick={onClose}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 8, cursor: 'pointer',
                color: 'var(--text-muted)', flexShrink: 0, marginLeft: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              aria-label="Close templates"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search
              size={15}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }}
            />
            <input
              id="template-search"
              type="text"
              placeholder="Search templates by name, description or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, fontSize: '0.88rem' }}
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 2, display: 'flex',
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category filter */}
          <CategoryFilter
            categories={TEMPLATE_CATEGORIES}
            active={category}
            onChange={setCategory}
            templateCounts={templateCounts}
          />
        </div>

        {/* ── Template Grid ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 20px',
              color: 'var(--text-muted)',
            }}>
              <Search size={40} style={{ opacity: 0.3 }} />
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>No templates found</div>
              <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 300 }}>
                Try a different search term or category.
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setCategory('all'); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                {filtered.length} template{filtered.length !== 1 ? 's' : ''}
                {search && ` matching "${search}"`}
                {category !== 'all' && !search && ` in ${TEMPLATE_CATEGORIES.find((c) => c.id === category)?.label || category}`}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 16,
              }}>
                {filtered.map((t) => (
                  <TemplateCard key={t.id} template={t} onUse={handleUse} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.75rem', color: 'var(--text-muted)',
        }}>
          <span>
            Templates load into the current workflow. Your existing nodes will be replaced.
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

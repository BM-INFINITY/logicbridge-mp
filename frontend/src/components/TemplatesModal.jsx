/**
 * TemplatesModal — full-page templates browser with search, category filtering,
 * template cards, and the "Use Template" flow.
 *
 * Opens as a full-page overlay (not a small modal) so templates have
 * the space they deserve as a proper product page.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import { getNodeIcon } from '../constants/Icons';
import { useTemplateFavorites } from '../hooks';
import {
  X, Search, Layers, Code2, Star,
  ArrowRight, Globe, Shuffle, GitBranch, Database, Table,
  Zap, FileText, Braces, Settings,
  Mail, Clock, Type, Calculator, Calendar, Sparkles, Filter, Tag,
} from 'lucide-react';

// ─── Icon lookup by string name ───────────────────────────────────────────────
// Used to resolve the `icon` string field in template metadata to a component.
const ICON_MAP = {
  Globe, Shuffle, GitBranch, Database, Table, Zap, FileText,
  Braces, Code2, Layers, Star, Settings,
  Mail, Clock, Type, Calculator, Calendar, Sparkles, Filter, Tag,
};

function resolveIcon(name) {
  return ICON_MAP[name] || Layers;
}

function TemplateIcon({ name, size = 20 }) {
  const Icon = resolveIcon(name);
  return <Icon size={size} />;
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

// ─── Connection Requirement Badge ─────────────────────────────────────────────
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
    postgres:      { label: 'Requires PostgreSQL', icon: Database, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
    mongodb:       { label: 'Requires MongoDB',    icon: Database, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    google_sheets: { label: 'Requires Sheets',     icon: Table,    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)' },
    email:         { label: 'Requires Email',      icon: Mail,     color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
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
      title={`Requires active ${c.label}`}
    >
      <ReqIcon size={10} /> {c.label}
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
function TemplateCard({ template, onUse, isFavorite, onToggleFavorite }) {
  const [hovered, setHovered] = useState(false);

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

      {/* Header: icon + name + difficulty + favorite button */}
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
function CategoryFilter({ categories, active, onChange, templateCounts, onlyFavorites, onToggleFavorites, favoritesCount }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
    }}>
      {/* Favorites Toggle Pill */}
      <button
        id="filter-favorites-btn"
        type="button"
        onClick={onToggleFavorites}
        aria-pressed={onlyFavorites}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 'var(--radius-full)',
          fontSize: '0.8rem', fontWeight: onlyFavorites ? 600 : 500,
          background: onlyFavorites ? '#f59e0b' : 'var(--bg-elevated)',
          color: onlyFavorites ? '#000' : 'var(--text-secondary)',
          border: `1px solid ${onlyFavorites ? '#f59e0b' : 'var(--border)'}`,
          cursor: 'pointer',
          transition: 'all var(--transition)',
          whiteSpace: 'nowrap',
        }}
      >
        <Star size={13} fill={onlyFavorites ? '#000' : 'none'} color={onlyFavorites ? '#000' : '#f59e0b'} />
        Favorites
        <span style={{
          fontSize: '0.65rem',
          background: onlyFavorites ? 'rgba(0,0,0,0.2)' : 'var(--bg-card)',
          borderRadius: 10, padding: '1px 6px',
          color: onlyFavorites ? '#000' : 'var(--text-muted)',
          fontWeight: 700,
        }}>
          {favoritesCount}
        </span>
      </button>

      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />

      {categories.map((cat) => {
        const count = templateCounts[cat.id] ?? 0;
        const isActive = !onlyFavorites && active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
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
  const [search, setSearch]             = useState('');
  const [category, setCategory]         = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { favorites, toggleFavorite, isFavorite } = useTemplateFavorites();

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Per-category counts for filter pills
  const templateCounts = useMemo(() => {
    const counts = {};
    TEMPLATE_CATEGORIES.forEach((cat) => {
      counts[cat.id] = TEMPLATES.filter((t) => t.category === cat.id).length;
    });
    return counts;
  }, []);

  // Filtered templates incorporating search, category, and favorites
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return TEMPLATES.filter((t) => {
      if (onlyFavorites && !favorites.includes(t.id)) return false;
      const catMatch = category === 'all' || t.category === category;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
        (t.nodeTypes || []).some((nt) => nt.toLowerCase().includes(q))
      );
    });
  }, [search, category, onlyFavorites, favorites]);

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
              placeholder="Search templates by name, description, tags, or node types…"
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

          {/* Category filter + Favorites pill */}
          <CategoryFilter
            categories={TEMPLATE_CATEGORIES}
            active={category}
            onChange={(catId) => {
              setCategory(catId);
            }}
            templateCounts={templateCounts}
            onlyFavorites={onlyFavorites}
            onToggleFavorites={() => setOnlyFavorites((prev) => !prev)}
            favoritesCount={favorites.length}
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
              {onlyFavorites && favorites.length === 0 ? (
                <>
                  <Star size={44} style={{ opacity: 0.35, color: '#f59e0b' }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    No favorite templates yet
                  </div>
                  <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 340, lineHeight: 1.5 }}>
                    Click the star icon on any template card to bookmark your most-used workflows for quick access.
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOnlyFavorites(false)}
                  >
                    Browse All Templates
                  </button>
                </>
              ) : onlyFavorites && favorites.length > 0 ? (
                <>
                  <Filter size={40} style={{ opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    No favorites match current filters
                  </div>
                  <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 320 }}>
                    Try clearing your search term or selecting a different category.
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearch(''); setCategory('all'); }}
                  >
                    Reset Search & Category
                  </button>
                </>
              ) : (
                <>
                  <Search size={40} style={{ opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    No templates found
                  </div>
                  <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 300 }}>
                    Try a different search term or category.
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearch(''); setCategory('all'); }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                <div>
                  {filtered.length} template{filtered.length !== 1 ? 's' : ''}
                  {onlyFavorites && ' in Favorites'}
                  {search && ` matching "${search}"`}
                  {category !== 'all' && !search && ` in ${TEMPLATE_CATEGORIES.find((c) => c.id === category)?.label || category}`}
                </div>
                {onlyFavorites && (
                  <button
                    onClick={() => setOnlyFavorites(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    View All Templates →
                  </button>
                )}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={handleUse}
                    isFavorite={isFavorite(t.id)}
                    onToggleFavorite={toggleFavorite}
                  />
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

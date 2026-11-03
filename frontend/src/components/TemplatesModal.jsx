/**
 * TemplatesModal — Full workflow template catalog and marketplace discovery modal.
 *
 * Supports search, multi-dimensional filtering (category, difficulty, favorites),
 * sorting (popularity, recency, alphabetical, difficulty), read-only visual preview,
 * recently used tracking, and pre-installation workflow customization.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import { useTemplateFavorites, useRecentTemplates } from '../hooks';
import { filterTemplates, sortTemplates } from '../utils/templateUtils';
import {
  TemplateCard,
  TemplateFilters,
  RecentlyUsedTemplates,
  TemplateDetailsModal,
  TemplateInstallModal,
} from './templates';
import { X, Star, Filter, Search } from 'lucide-react';

export default function TemplatesModal({ onClose, onLoad }) {
  const [search, setSearch]               = useState('');
  const [category, setCategory]           = useState('all');
  const [difficulty, setDifficulty]       = useState('all');
  const [sortBy, setSortBy]               = useState('popularity');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modals for preview and install configuration
  const [previewTemplate, setPreviewTemplate]       = useState(null);
  const [installingTemplate, setInstallingTemplate] = useState(null);

  const { favorites, toggleFavorite, isFavorite }   = useTemplateFavorites();
  const { recentTemplates, addRecentTemplate, clearRecentTemplates } = useRecentTemplates();

  // Close modal on Escape key press (unless a sub-modal is open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !previewTemplate && !installingTemplate) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewTemplate, installingTemplate]);

  // Per-category counts for filter badges
  const templateCounts = useMemo(() => {
    const counts = {};
    TEMPLATE_CATEGORIES.forEach((cat) => {
      counts[cat.id] = TEMPLATES.filter((t) => t.category === cat.id).length;
    });
    return counts;
  }, []);

  // Filtered and sorted templates
  const filteredAndSorted = useMemo(() => {
    const filtered = filterTemplates(TEMPLATES, {
      search,
      category,
      difficulty,
      onlyFavorites,
      favorites,
    });
    return sortTemplates(filtered, sortBy);
  }, [search, category, difficulty, onlyFavorites, favorites, sortBy]);

  // Direct trigger to start the install configuration flow
  const handleInitiateInstall = (template) => {
    setPreviewTemplate(null);
    setInstallingTemplate(template);
  };

  // Final execution of template instantiation & load into parent page
  const handleConfirmInstall = async (template, installConfig) => {
    addRecentTemplate(template);
    if (typeof onLoad === 'function') {
      await onLoad(template, installConfig);
    }
    onClose();
  };

  // Quick use directly from recently used templates banner
  const handleQuickUseRecent = (recentItem) => {
    const fullTemplate = TEMPLATES.find((t) => t.id === recentItem.id);
    if (fullTemplate) {
      handleInitiateInstall(fullTemplate);
    }
  };

  return (
    <div
      id="templates-marketplace-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        id="templates-marketplace-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1080,
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          minHeight: 'min(90vh, 720px)',
          maxHeight: '90vh',
        }}
      >
        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: 4 }}>
                Workflow Templates Marketplace
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Explore production-ready workflow recipes. Preview step sequences or install directly into your workspace.
              </p>
            </div>
            <button
              id="templates-modal-close"
              type="button"
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
              aria-label="Close templates marketplace"
            >
              <X size={18} />
            </button>
          </div>

          {/* Recently Used Templates Strip */}
          <RecentlyUsedTemplates
            recentTemplates={recentTemplates}
            onUseTemplate={handleQuickUseRecent}
            onClearRecents={clearRecentTemplates}
          />

          {/* Search, Filters, and Sorting Controls */}
          <TemplateFilters
            search={search}
            onSearchChange={setSearch}
            categories={TEMPLATE_CATEGORIES}
            category={category}
            onCategoryChange={setCategory}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onlyFavorites={onlyFavorites}
            onToggleFavorites={() => setOnlyFavorites((prev) => !prev)}
            favoritesCount={favorites.length}
            templateCounts={templateCounts}
            totalCount={TEMPLATES.length}
          />
        </div>

        {/* ── Catalog Grid ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {filteredAndSorted.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 20px',
              color: 'var(--text-muted)',
            }}>
              {onlyFavorites && favorites.length === 0 ? (
                <>
                  <Star size={44} style={{ opacity: 0.35, color: '#f59e0b' }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    No favorite templates bookmarked yet
                  </div>
                  <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
                    Click the star icon on any template card to save your most frequently used workflows for instant access.
                  </div>
                  <button
                    type="button"
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
                    Try clearing your search query or selecting &quot;All Templates&quot;.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearch(''); setCategory('all'); setDifficulty('all'); }}
                  >
                    Reset Filters
                  </button>
                </>
              ) : (
                <>
                  <Search size={40} style={{ opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    No templates match your criteria
                  </div>
                  <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 300 }}>
                    Try searching with broader terms or clear your active filters.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearch(''); setCategory('all'); setDifficulty('all'); }}
                  >
                    Clear All Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Results status header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16,
              }}>
                <div>
                  Showing <strong>{filteredAndSorted.length}</strong> template{filteredAndSorted.length !== 1 ? 's' : ''}
                  {onlyFavorites && ' in Favorites'}
                  {category !== 'all' && ` • ${TEMPLATE_CATEGORIES.find((c) => c.id === category)?.label || category}`}
                  {difficulty !== 'all' && ` • ${difficulty}`}
                  {search && ` matching "${search}"`}
                </div>
                {onlyFavorites && (
                  <button
                    type="button"
                    onClick={() => setOnlyFavorites(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    View All Templates →
                  </button>
                )}
              </div>

              {/* Template cards grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: 16,
              }}>
                {filteredAndSorted.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={handleInitiateInstall}
                    onPreview={setPreviewTemplate}
                    isFavorite={isFavorite(t.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.75rem', color: 'var(--text-muted)',
        }}>
          <span>
            Installing a template creates a new workflow with unique node IDs while preserving variable references.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Read-Only Details / Preview Dialog */}
      {previewTemplate && (
        <TemplateDetailsModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onInstall={handleInitiateInstall}
        />
      )}

      {/* Pre-installation Configuration & Naming Dialog */}
      {installingTemplate && (
        <TemplateInstallModal
          template={installingTemplate}
          onClose={() => setInstallingTemplate(null)}
          onConfirmInstall={handleConfirmInstall}
        />
      )}
    </div>
  );
}

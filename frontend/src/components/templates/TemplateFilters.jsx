import React from 'react';
import { Search, X, Star, ArrowUpDown } from 'lucide-react';

export default function TemplateFilters({
  search,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  sortBy,
  onSortChange,
  onlyFavorites,
  onToggleFavorites,
  favoritesCount,
  templateCounts = {},
  totalCount = 0,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
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
            placeholder="Search templates by name, use case, tags, or nodes…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 36, fontSize: '0.88rem', width: '100%' }}
            autoFocus
          />
          {search && (
            <button
              id="clear-search-btn"
              type="button"
              onClick={() => onSearchChange('')}
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

        {/* Difficulty Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            id="template-difficulty-filter"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            className="form-input"
            style={{
              fontSize: '0.8rem',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              minWidth: 130,
            }}
            aria-label="Filter by difficulty"
          >
            <option value="all">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Sort Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <ArrowUpDown size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <select
              id="template-sort-by"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="form-input"
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px 6px 30px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                minWidth: 150,
              }}
              aria-label="Sort templates"
            >
              <option value="popularity">Most Popular</option>
              <option value="recent">Recently Added</option>
              <option value="name">Name (A–Z)</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Pills + Favorites Toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Favorites Toggle Button */}
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

        {/* Category Pills */}
        {categories.map((cat) => {
          const count = cat.id === 'all' ? totalCount : (templateCounts[cat.id] ?? 0);
          const isActive = !onlyFavorites && category === cat.id;

          return (
            <button
              key={cat.id}
              id={`filter-category-${cat.id}`}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
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
                fontSize: '0.65rem',
                background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                borderRadius: 10, padding: '1px 6px',
                color: isActive ? '#fff' : 'var(--text-muted)',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


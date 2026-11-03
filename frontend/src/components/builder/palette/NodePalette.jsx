import React, { useState, useMemo } from 'react';
import { Search, X, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { NODE_DEFS } from '../../../data/templates';
import { getNodeIcon } from '../../../constants/Icons';
import { EmptyState } from '../../ui';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'action', label: 'Actions' },
  { id: 'logic', label: 'Logic' },
  { id: 'ai', label: 'AI' },
];

export default function NodePalette() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Canonical nodes list from Object.entries(NODE_DEFS)
  // Non-enumerable aliases are automatically excluded by Object.entries
  const allNodes = useMemo(() => {
    return Object.entries(NODE_DEFS);
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: allNodes.length, trigger: 0, action: 0, logic: 0, ai: 0 };
    allNodes.forEach(([, def]) => {
      if (counts[def.category] !== undefined) {
        counts[def.category]++;
      }
    });
    return counts;
  }, [allNodes]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allNodes.filter(([type, def]) => {
      const matchCat = category === 'all' || def.category === category;
      if (!matchCat) return false;
      if (!q) return true;

      const matchLabel = def.label?.toLowerCase().includes(q);
      const matchType = type.toLowerCase().includes(q);
      const matchDesc = def.description?.toLowerCase().includes(q);
      const matchCategory = def.category?.toLowerCase().includes(q);

      return matchLabel || matchType || matchDesc || matchCategory;
    });
  }, [allNodes, search, category]);

  // Grouped by category
  const groupedNodes = useMemo(() => {
    const cats = ['trigger', 'action', 'logic', 'ai'];
    const groups = {};
    cats.forEach((c) => {
      groups[c] = filteredNodes.filter(([, d]) => d.category === c);
    });
    return groups;
  }, [filteredNodes]);

  if (isCollapsed) {
    return (
      <div
        style={{
          width: 36,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="btn btn-ghost"
          style={{ padding: 6, color: 'var(--text-muted)' }}
          title="Expand Node Palette"
          aria-label="Expand Node Palette"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="node-palette"
      style={{
        width: 240,
        minWidth: 240,
        maxWidth: 240,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
        height: '100%',
      }}
      aria-label="Workflow Node Palette"
    >
      {/* Palette Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px 8px 14px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.74rem', letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Node Palette
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 4px', height: 'auto', color: 'var(--text-muted)' }}
          title="Collapse Palette"
          aria-label="Collapse Palette"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '0 12px 8px 12px', position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          id="node-palette-search"
          type="text"
          className="form-input"
          placeholder="Search by name, action, logic..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: '0.75rem',
            padding: '5px 8px 5px 26px',
            height: 28,
            borderRadius: 'var(--radius-sm)',
            width: '100%',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0,
            }}
            aria-label="Clear node search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category Filter Pills with Item Counts */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          padding: '0 12px 10px 12px',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          const isSelected = category === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                padding: '2px 7px',
                fontSize: '0.68rem',
                fontWeight: 500,
                borderRadius: 4,
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(108, 99, 255, 0.15)' : 'var(--bg-elevated)',
                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{cat.label}</span>
              <span style={{ fontSize: '0.62rem', opacity: 0.75 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Nodes List Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {filteredNodes.length === 0 ? (
          <div style={{ padding: '24px 8px' }}>
            <EmptyState
              icon={<Search size={24} />}
              title="No nodes found"
              description={`No steps match "${search}". Try searching for HTTP, webhook, AI, or condition.`}
              action={{
                label: 'Clear Search',
                onClick: () => { setSearch(''); setCategory('all'); },
              }}
            />
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Drag step onto canvas:
            </div>

            {['trigger', 'action', 'logic', 'ai'].map((cat) => {
              const nodesInCat = groupedNodes[cat];
              if (!nodesInCat || nodesInCat.length === 0) return null;

              const sectionTitle =
                cat === 'trigger' ? 'Triggers' :
                cat === 'action' ? 'Actions' :
                cat === 'logic' ? 'Logic & Flow' : 'AI / LLM';

              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    {sectionTitle} ({nodesInCat.length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nodesInCat.map(([type, def]) => {
                      const NodeIcon = getNodeIcon(type);

                      return (
                        <div
                          key={type}
                          className="palette-node"
                          draggable
                          onDragStart={(e) => onDragStart(e, type)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = def.color;
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                          title={`Drag to add ${def.label}\n${def.description || ''}`}
                        >
                          <GripVertical size={12} color="var(--text-muted)" style={{ opacity: 0.5, flexShrink: 0 }} />

                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 5,
                              background: `${def.color}20`,
                              color: def.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <NodeIcon size={13} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {def.label}
                            </div>
                            {def.description && (
                              <div
                                style={{
                                  fontSize: '0.66rem',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {def.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

import React, { useState, useMemo } from 'react';
import {
  Copy, Check, ChevronDown, ChevronRight, Search, X, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';

function JsonNode({ keyName, value, depth = 0, defaultOpen = true, searchTerm = '' }) {
  const [open, setOpen] = useState(defaultOpen && depth < 3);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const keyMatch = keyName ? String(keyName).toLowerCase().includes(term) : false;
    if (keyMatch) return true;
    if (!isObject) {
      return String(value).toLowerCase().includes(term);
    }
    try {
      return JSON.stringify(value).toLowerCase().includes(term);
    } catch {
      return false;
    }
  }, [keyName, value, isObject, searchTerm]);

  if (searchTerm && !matchesSearch) {
    return null;
  }

  // Primitive value rendering
  if (!isObject) {
    let color = '#34d399'; // string = emerald
    let rendered = `"${String(value)}"`;

    if (typeof value === 'number') {
      color = '#fbbf24'; // number = amber
      rendered = String(value);
    } else if (typeof value === 'boolean') {
      color = '#a78bfa'; // boolean = purple
      rendered = String(value);
    } else if (value === null) {
      color = '#94a3b8'; // null = slate
      rendered = 'null';
    } else if (value === undefined) {
      color = '#94a3b8';
      rendered = 'undefined';
    }

    return (
      <div
        style={{
          paddingLeft: depth * 14,
          fontSize: '0.74rem',
          fontFamily: 'monospace',
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
        {keyName !== undefined && (
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>"{keyName}":</span>
        )}
        <span style={{ color }}>{rendered}</span>
      </div>
    );
  }

  const keys = Object.keys(value);
  const count = keys.length;

  return (
    <div style={{ paddingLeft: depth * 14, fontSize: '0.74rem', fontFamily: 'monospace', lineHeight: 1.5 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {open ? <ChevronDown size={12} color="var(--text-muted)" /> : <ChevronRight size={12} color="var(--text-muted)" />}
        {keyName !== undefined && (
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>"{keyName}":</span>
        )}
        <span style={{ color: 'var(--text-secondary)' }}>
          {isArray ? `Array(${count})` : `Object{${count}}`}
        </span>
      </div>

      {open && (
        <div style={{ borderLeft: '1px dashed var(--border-light)', marginLeft: 5, paddingLeft: 6 }}>
          {keys.map((k) => (
            <JsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={value[k]}
              depth={1}
              defaultOpen={depth < 2}
              searchTerm={searchTerm}
            />
          ))}
          {count === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: 14 }}>
              {isArray ? '[]' : '{}'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JsonViewer({
  data,
  maxHeight = 320,
  title,
  enableSearch = true,
  enableCopy = true,
  expandLevel = 2,
  emptyText = 'No data available',
}) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [expandAllKey, setExpandAllKey] = useState(0);
  const [expandAllState, setExpandAllState] = useState(true);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'raw'
  const [showFull, setShowFull] = useState(false);

  const jsonString = useMemo(() => {
    try {
      if (typeof data === 'string') {
        try {
          return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          return data;
        }
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const parsedData = useMemo(() => {
    if (data === null || data === undefined) return null;
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }, [data]);

  const isOversized = useMemo(() => {
    return jsonString && jsonString.length > 50000;
  }, [jsonString]);

  const displayedRaw = useMemo(() => {
    if (!isOversized || showFull) return jsonString;
    return jsonString.slice(0, 30000) + `\n\n... [Truncated: ${Math.round((jsonString.length - 30000) / 1024)} KB remaining. Click 'Show Full Data']`;
  }, [jsonString, isOversized, showFull]);

  const handleCopy = () => {
    if (!jsonString) return;
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success('JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleExpandAll = () => {
    setExpandAllState(!expandAllState);
    setExpandAllKey((k) => k + 1);
  };

  if (data === null || data === undefined || (typeof data === 'object' && Object.keys(data).length === 0 && !Array.isArray(data))) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.78rem',
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Viewer Header / Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {title && (
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {title}
          </span>
        )}

        {/* View Mode Switcher (Tree vs Raw) */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 4, padding: 2, border: '1px solid var(--border)' }}>
          <button
            onClick={() => setViewMode('tree')}
            style={{
              padding: '2px 8px',
              fontSize: '0.68rem',
              fontWeight: 500,
              background: viewMode === 'tree' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'tree' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('raw')}
            style={{
              padding: '2px 8px',
              fontSize: '0.68rem',
              fontWeight: 500,
              background: viewMode === 'raw' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'raw' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Raw JSON
          </button>
        </div>

        {/* Search within payload */}
        {enableSearch && viewMode === 'tree' && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={11} style={{ position: 'absolute', left: 6, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search keys/values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                fontSize: '0.68rem',
                padding: '2px 20px 2px 20px',
                height: 22,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                width: 140,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {viewMode === 'tree' && (
            <button
              onClick={handleToggleExpandAll}
              title={expandAllState ? 'Collapse All' : 'Expand All'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {expandAllState ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              <span>{expandAllState ? 'Collapse' : 'Expand'}</span>
            </button>
          )}

          {enableCopy && (
            <button
              onClick={handleCopy}
              title="Copy JSON Payload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Body */}
      <div
        style={{
          maxHeight,
          overflowY: 'auto',
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
        }}
      >
        {viewMode === 'tree' && typeof parsedData === 'object' && parsedData !== null ? (
          <div key={expandAllKey}>
            {Object.keys(parsedData).map((k) => (
              <JsonNode
                key={k}
                keyName={Array.isArray(parsedData) ? undefined : k}
                value={parsedData[k]}
                depth={0}
                defaultOpen={expandAllState}
                searchTerm={search}
              />
            ))}
          </div>
        ) : (
          <pre
            style={{
              fontSize: '0.73rem',
              fontFamily: 'monospace',
              color: '#22d3ee',
              margin: 0,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {displayedRaw}
          </pre>
        )}

        {isOversized && !showFull && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: '#f59e0b',
            }}
          >
            <span>Payload truncated for performance ({Math.round(jsonString.length / 1024)} KB total)</span>
            <button
              onClick={() => setShowFull(true)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.7rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Show Full Payload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { Clipboard, CheckSquare, Maximize2 } from 'lucide-react';
import useCanvasStore from '../../../store/canvasStore';

export default function CanvasContextMenu({ x, y, onClose, onFitView }) {
  const menuRef = useRef(null);
  const { clipboard, pasteNodes, selectAllNodes, nodes } = useCanvasStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePaste = () => {
    pasteNodes({ x: 40, y: 40 });
    onClose();
  };

  const handleSelectAll = () => {
    selectAllNodes();
    onClose();
  };

  const handleFitView = () => {
    if (onFitView) onFitView();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Canvas Context Menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 170,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <button
        className="dropdown-item"
        disabled={!clipboard || clipboard.length === 0}
        onClick={handlePaste}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.78rem',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          cursor: !clipboard || clipboard.length === 0 ? 'not-allowed' : 'pointer',
          opacity: !clipboard || clipboard.length === 0 ? 0.5 : 1,
          color: 'var(--text-primary)',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <Clipboard size={14} color="var(--accent-primary)" />
        <span>Paste</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ctrl+V</span>
      </button>

      <button
        className="dropdown-item"
        disabled={nodes.length === 0}
        onClick={handleSelectAll}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.78rem',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
          opacity: nodes.length === 0 ? 0.5 : 1,
          color: 'var(--text-primary)',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <CheckSquare size={14} color="#10b981" />
        <span>Select All</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ctrl+A</span>
      </button>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <button
        className="dropdown-item"
        onClick={handleFitView}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.78rem',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <Maximize2 size={14} color="var(--text-secondary)" />
        <span>Fit to Screen</span>
      </button>
    </div>
  );
}

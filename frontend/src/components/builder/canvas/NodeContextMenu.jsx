import React, { useEffect, useRef } from 'react';
import { Settings, Copy, Files, Trash2 } from 'lucide-react';
import useCanvasStore from '../../../store/canvasStore';

export default function NodeContextMenu({ x, y, node, onClose, onConfigure }) {
  const menuRef = useRef(null);
  const { duplicateNode, copySelected, deleteNode } = useCanvasStore();

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

  if (!node) return null;

  const handleConfigure = () => {
    if (onConfigure) onConfigure(node);
    onClose();
  };

  const handleDuplicate = () => {
    duplicateNode(node.id, { x: 40, y: 40 });
    onClose();
  };

  const handleCopy = () => {
    useCanvasStore.setState({ selectedNode: node });
    copySelected();
    onClose();
  };

  const handleDelete = () => {
    deleteNode(node.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Node Context Menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 175,
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
        onClick={handleConfigure}
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
        <Settings size={14} color="var(--accent-primary)" />
        <span>Configure Step</span>
      </button>

      <button
        className="dropdown-item"
        onClick={handleDuplicate}
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
        <Files size={14} color="#0ea5e9" />
        <span>Duplicate</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ctrl+D</span>
      </button>

      <button
        className="dropdown-item"
        onClick={handleCopy}
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
        <Copy size={14} color="#8b5cf6" />
        <span>Copy Node</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ctrl+C</span>
      </button>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <button
        className="dropdown-item"
        onClick={handleDelete}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.78rem',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--danger)',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <Trash2 size={14} color="var(--danger)" />
        <span>Delete Node</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Del</span>
      </button>
    </div>
  );
}


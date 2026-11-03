import React, { useMemo, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { GitBranch } from 'lucide-react';
import { NODE_DEFS } from '../../../data/templates';
import useCanvasStore from '../../../store/canvasStore';
import NodeValidator from '../../../validators/NodeValidator';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import CanvasContextMenu from './CanvasContextMenu';
import NodeContextMenu from './NodeContextMenu';

export default function Canvas({
  onInit,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDrop,
  wrapperRef,
  displayNodes,
  displayEdges,
  rfInstance,
}) {
  const storeState = useCanvasStore();
  const activeNodes = displayNodes || storeState.nodes;
  const activeEdges = displayEdges || storeState.edges;
  const showMinimap = storeState.showMinimap;

  // Context Menu State
  const [canvasMenu, setCanvasMenu] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null);

  // Dynamic node types registry with CustomNode
  const nodeTypes = useMemo(() => {
    const types = {
      default: CustomNode,
    };
    Object.keys(NODE_DEFS).forEach((k) => {
      types[k] = CustomNode;
    });
    return types;
  }, []);

  const edgeTypes = useMemo(() => ({
    default: CustomEdge,
    custom: CustomEdge,
  }), []);

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Connection validation callback: prevents self-connections and duplicate branch handles
  const isValidConnection = useCallback(
    (connection) => {
      // 1. Disallow self connections
      if (connection.source === connection.target) {
        return false;
      }

      // 2. Disallow duplicate connections from unique branch handles
      const check = NodeValidator.validateConditionConnection(
        {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
        },
        activeEdges
      );

      return check.valid;
    },
    [activeEdges]
  );

  const handlePaneContextMenu = (event) => {
    event.preventDefault();
    setNodeMenu(null);
    setCanvasMenu({ x: event.clientX, y: event.clientY });
  };

  const handleNodeContextMenu = (event, node) => {
    event.preventDefault();
    event.stopPropagation();
    setCanvasMenu(null);
    setNodeMenu({ x: event.clientX, y: event.clientY, node });
  };

  const handleCanvasClick = (e) => {
    setCanvasMenu(null);
    setNodeMenu(null);
    if (onPaneClick) onPaneClick(e);
  };

  return (
    <div ref={wrapperRef} style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={activeNodes}
        edges={activeEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(e, node) => {
          setCanvasMenu(null);
          setNodeMenu(null);
          if (onNodeClick) onNodeClick(e, node);
        }}
        onPaneClick={handleCanvasClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        snapToGrid={true}
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={2}
        fitView
        style={{ background: 'var(--bg-base)' }}
        defaultEdgeOptions={{
          type: 'default',
          animated: true,
          style: { stroke: 'var(--accent-primary)', strokeWidth: 2 },
        }}
      >
        {/* Theme-Adaptive Background Grid */}
        <Background color="var(--border)" gap={20} size={1.2} />

        <Controls
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        />

        {showMinimap && (
          <MiniMap
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
            nodeColor={(n) => {
              const def = NODE_DEFS[n.type];
              if (def?.category === 'trigger') return '#10b981';
              if (def?.category === 'logic') return '#f59e0b';
              if (def?.category === 'ai') return '#8b5cf6';
              return '#6366f1';
            }}
            maskColor="rgba(0, 0, 0, 0.4)"
          />
        )}
      </ReactFlow>

      {/* Empty State Overlay */}
      {activeNodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 14,
              color: 'var(--text-muted)',
              opacity: 0.6,
            }}
          >
            <GitBranch size={52} strokeWidth={1.3} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 8 }}>
            Build your workflow visually
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
            Drag and drop steps from the palette on the left, load an existing{' '}
            <strong style={{ color: 'var(--accent-primary)' }}>Template</strong>, or use{' '}
            <strong style={{ color: '#22d3ee' }}>AI Assist</strong> to generate a complete workflow.
          </div>
        </div>
      )}

      {/* Canvas Context Menu (Right Click on Empty Space) */}
      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          onClose={() => setCanvasMenu(null)}
          onFitView={() => {
            if (rfInstance?.fitView) rfInstance.fitView({ padding: 0.2, duration: 400 });
          }}
        />
      )}

      {/* Node Context Menu (Right Click on a Node) */}
      {nodeMenu && (
        <NodeContextMenu
          x={nodeMenu.x}
          y={nodeMenu.y}
          node={nodeMenu.node}
          onClose={() => setNodeMenu(null)}
          onConfigure={(n) => {
            if (onNodeClick) onNodeClick(null, n);
          }}
        />
      )}
    </div>
  );
}

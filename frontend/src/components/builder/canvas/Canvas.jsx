import React from 'react';
import ReactFlow, { Background, Controls, MiniMap, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { NODE_DEFS } from '../../../data/templates';
import useCanvasStore from '../../../store/canvasStore';
import { BranchColors } from '../../../constants';

// ─── Custom Node Renderer ───────────────────────────────────────────────────
function CustomNode({ data, selected, type }) {
  const def = NODE_DEFS[type] || { label: type, icon: '⚙️', color: '#6c63ff', category: 'action' };
  const isFirst = def.category === 'trigger';
  const isCondition = type === 'logic-condition';
  const execStatus = data._execStatus;

  return (
    <div
      className={`flow-node node-${def.category}`}
      style={{
        borderColor: execStatus === 'success' ? BranchColors.TRUE : execStatus === 'failed' ? BranchColors.FALSE : execStatus === 'skipped' ? BranchColors.SKIPPED : selected ? def.color : undefined,
        boxShadow: execStatus === 'success' ? '0 0 16px rgba(34,197,94,0.35)' : execStatus === 'failed' ? '0 0 16px rgba(239,68,68,0.35)' : selected ? `0 0 20px ${def.color}40` : undefined,
        opacity: execStatus === 'skipped' ? 0.6 : 1,
      }}
    >
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: def.color, width: 10, height: 10, border: '2px solid var(--bg-base)' }}
        />
      )}
      <div className="flow-node-header">
        <div className="flow-node-icon" style={{ background: `${def.color}22`, color: def.color }}>
          <span style={{ fontSize: 14 }}>{def.icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="flow-node-label">{data.label || def.label}</div>
          <div className="flow-node-type">{def.category.toUpperCase()}</div>
        </div>
        {execStatus && (
          <div style={{ marginLeft: 4 }}>
            {execStatus === 'success' && <CheckCircle2 size={14} color={BranchColors.TRUE} />}
            {execStatus === 'failed' && <XCircle size={14} color={BranchColors.FALSE} />}
            {execStatus === 'skipped' && <AlertCircle size={14} color={BranchColors.SKIPPED} />}
            {execStatus === 'running' && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
          </div>
        )}
      </div>
      {data.url && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
          {data.url}
        </div>
      )}
      {data.message && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.message}
        </div>
      )}

      {isCondition ? (
        <>
          {/* True Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '30%', background: BranchColors.TRUE, width: 10, height: 10, border: '2px solid var(--bg-base)' }}
          />
          <div style={{ position: 'absolute', right: -36, top: '22%', fontSize: '0.65rem', fontWeight: 700, color: BranchColors.TRUE }}>
            TRUE
          </div>

          {/* False Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: '70%', background: BranchColors.FALSE, width: 10, height: 10, border: '2px solid var(--bg-base)' }}
          />
          <div style={{ position: 'absolute', right: -42, top: '62%', fontSize: '0.65rem', fontWeight: 700, color: BranchColors.FALSE }}>
            FALSE
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: def.color, width: 10, height: 10, border: '2px solid var(--bg-base)' }}
        />
      )}
    </div>
  );
}

const nodeTypes = Object.fromEntries(Object.keys(NODE_DEFS).map((k) => [k, CustomNode]));

export default function Canvas({
  onInit,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDrop,
  wrapperRef,
}) {
  const { nodes, edges } = useCanvasStore();

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: 'var(--bg-base)' }}
        defaultEdgeOptions={{ animated: true, style: { stroke: '#6c63ff', strokeWidth: 2 } }}
      >
        <Background color="#1e2332" gap={24} size={1.5} />
        <Controls style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <MiniMap style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }} nodeColor="#6c63ff" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔗</div>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Start building your workflow</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Drag nodes from the palette · or load a <strong style={{ color: 'var(--accent-primary)' }}>Template</strong> · or use <strong style={{ color: '#22d3ee' }}>AI Generate</strong>
          </div>
        </div>
      )}
    </div>
  );
}

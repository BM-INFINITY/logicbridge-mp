import { useCallback } from 'react';
import useCanvasStore from '../store/canvasStore';
import { NODE_DEFS } from '../data/templates';
import { normalizeNodeType } from '../constants/NodeTypes.js';

/**
 * Custom hook providing node addition, connection, and drag-and-drop handles
 */
export function useNodeOperations(rfInstance, wrapperRef) {
  const { addNode, updateNodeData, deleteNode } = useCanvasStore();

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const rawType = e.dataTransfer.getData('application/reactflow');
      if (!rawType || !rfInstance || !wrapperRef?.current) return;
      const type = normalizeNodeType(rawType);

      const bounds = wrapperRef.current.getBoundingClientRect();
      const pos = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const def = NODE_DEFS[type];
      addNode({
        id: `node_${Date.now()}`,
        type,
        position: pos,
        data: { label: def?.label || type },
      });
    },
    [rfInstance, wrapperRef, addNode]
  );

  return {
    handleDrop,
    updateNodeData,
    deleteNode,
  };
}

export default useNodeOperations;

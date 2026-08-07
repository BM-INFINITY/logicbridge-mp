import { useCallback } from 'react';
import useCanvasStore from '../store/canvasStore';
import { NODE_DEFS } from '../data/templates';

/**
 * Custom hook providing node addition, connection, and drag-and-drop handles
 */
export function useNodeOperations(rfInstance, wrapperRef) {
  const { setNodes, setEdges, addNode, updateNodeData, deleteNode } = useCanvasStore();

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type || !rfInstance || !wrapperRef?.current) return;

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

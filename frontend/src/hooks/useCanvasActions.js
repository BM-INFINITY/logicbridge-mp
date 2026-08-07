import useCanvasStore from '../store/canvasStore';

/**
 * Custom hook wrapping common canvas actions
 */
export function useCanvasActions() {
  const { setNodes, setEdges, updateNodeData, deleteNode, setSelectedNode, resetCanvas } = useCanvasStore();

  return {
    setNodes,
    setEdges,
    updateNodeData,
    deleteNode,
    setSelectedNode,
    resetCanvas,
  };
}

export default useCanvasActions;

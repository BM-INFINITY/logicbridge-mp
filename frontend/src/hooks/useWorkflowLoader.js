import { useEffect } from 'react';
import useWorkflowStore from '../store/workflowStore';
import useCanvasStore from '../store/canvasStore';

/**
 * Custom hook for fetching and initializing workflow data into canvas store
 */
export function useWorkflowLoader(workflowId) {
  const { fetchWorkflow } = useWorkflowStore();
  const { setNodes, setEdges, resetCanvas } = useCanvasStore();

  useEffect(() => {
    if (!workflowId) return;
    fetchWorkflow(workflowId).then((wf) => {
      if (wf) {
        setNodes(wf.nodes || []);
        setEdges(wf.edges || []);
      }
    });

    return () => {
      resetCanvas();
    };
  }, [workflowId]);
}

export default useWorkflowLoader;

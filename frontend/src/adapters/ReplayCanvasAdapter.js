import { BranchColors } from '../constants/BranchColors.js';

/**
 * ReplayCanvasAdapter — decouples React Flow canvas rendering from replay store state.
 * Transforms nodes and edges based on an ExecutionSnapshot.
 */
export const ReplayCanvasAdapter = {
  /**
   * Applies an ExecutionSnapshot to nodes and edges to compute canvas display state.
   *
   * @param {Array} nodes - Original canvas React Flow nodes
   * @param {Array} edges - Original canvas React Flow edges
   * @param {ExecutionSnapshot} snapshot - Target snapshot frame
   * @returns {{ nodes: Array, edges: Array, focusNodeId: string|null }}
   */
  applySnapshotToCanvas(nodes, edges, snapshot) {
    if (!snapshot) {
      return { nodes, edges, focusNodeId: null };
    }

    const { nodeStatusMap = {}, activeNodeId, selectedBranches = {} } = snapshot;

    // Transform nodes with snapshot execution status and active state flags
    const updatedNodes = nodes.map((node) => {
      const status = nodeStatusMap[node.id] || 'pending';
      const isActive = activeNodeId === node.id;
      const isSkipped = status === 'skipped';

      return {
        ...node,
        data: {
          ...node.data,
          _execStatus: status,
          _isActive: isActive,
          _isSkipped: isSkipped,
        },
      };
    });

    // Transform edges based on node execution status and branch selections
    const updatedEdges = edges.map((edge) => {
      const sourceStatus = nodeStatusMap[edge.source];
      const targetStatus = nodeStatusMap[edge.target];
      const selectedBranch = selectedBranches[edge.source];

      // Default edge styling
      let stroke = '#6c63ff';
      let strokeWidth = 2;
      let animated = false;
      let opacity = 0.8;

      // ── Condition Branch Highlighting ──────────────────────────────────────
      if (selectedBranch !== undefined) {
        const handleId = edge.sourceHandle || 'true';
        if (handleId === selectedBranch) {
          // Selected active branch
          stroke = handleId === 'true' ? BranchColors.TRUE : BranchColors.FALSE;
          strokeWidth = 3.5;
          animated = true;
          opacity = 1;
        } else {
          // Unselected branch path
          stroke = '#475569';
          strokeWidth = 1.5;
          animated = false;
          opacity = 0.25;
        }
      } else if (sourceStatus === 'success' && targetStatus !== 'pending') {
        // Standard executed path
        stroke = BranchColors.TRUE;
        strokeWidth = 2.5;
        animated = true;
        opacity = 1;
      } else if (sourceStatus === 'failed') {
        stroke = BranchColors.FALSE;
        strokeWidth = 2.5;
        animated = false;
        opacity = 1;
      } else if (sourceStatus === 'skipped' || targetStatus === 'skipped') {
        stroke = BranchColors.SKIPPED;
        strokeWidth = 1.5;
        animated = false;
        opacity = 0.3;
      } else if (sourceStatus === 'running') {
        stroke = '#3b82f6';
        strokeWidth = 3;
        animated = true;
        opacity = 1;
      }

      return {
        ...edge,
        animated,
        style: {
          ...edge.style,
          stroke,
          strokeWidth,
          opacity,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease',
        },
      };
    });

    return {
      nodes: updatedNodes,
      edges: updatedEdges,
      focusNodeId: activeNodeId || snapshot.nodeId || null,
    };
  },
};

export default ReplayCanvasAdapter;

import { create } from 'zustand';

/**
 * Pure UI & Canvas State Store for React Flow Builder
 * Structured into Graph State, History / Clipboard, UI State, and Execution State
 */
const useCanvasStore = create((set, get) => ({
  // ─── 1. Graph State ────────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  selectedNode: null,

  setNodes: (nodesOrUpdater) => {
    set((state) => ({
      nodes: typeof nodesOrUpdater === 'function' ? nodesOrUpdater(state.nodes) : nodesOrUpdater,
    }));
  },

  setEdges: (edgesOrUpdater) => {
    set((state) => ({
      edges: typeof edgesOrUpdater === 'function' ? edgesOrUpdater(state.edges) : edgesOrUpdater,
    }));
  },

  setSelectedNode: (selectedNode) => set({ selectedNode }),

  addNode: (node) => {
    get().takeSnapshot();
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNode: node,
    }));
  },

  updateNodeData: (id, data) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    selectedNode: state.selectedNode?.id === id ? { ...state.selectedNode, data: { ...state.selectedNode.data, ...data } } : state.selectedNode,
  })),

  deleteNode: (id) => {
    get().takeSnapshot();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNode: state.selectedNode?.id === id ? null : state.selectedNode,
    }));
  },

  deleteEdge: (id) => {
    get().takeSnapshot();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
  },

  // ─── 2. Undo / Redo History ────────────────────────────────────────────────
  history: {
    past: [],   // Array of { nodes, edges } snapshots
    future: [], // Array of { nodes, edges } snapshots
  },

  takeSnapshot: () => {
    const { nodes, edges, history } = get();
    // Deep clone state to prevent reference mutation
    const currentSnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    const newPast = [...history.past, currentSnapshot].slice(-30);
    set({
      history: {
        past: newPast,
        future: [],
      },
    });
  },

  undo: () => {
    const { nodes, edges, history } = get();
    if (!history.past || history.past.length === 0) return false;

    const previousSnapshot = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    const newFuture = [
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      },
      ...history.future,
    ].slice(0, 30);

    set({
      nodes: previousSnapshot.nodes,
      edges: previousSnapshot.edges,
      selectedNode: null,
      history: {
        past: newPast,
        future: newFuture,
      },
    });
    return true;
  },

  redo: () => {
    const { nodes, edges, history } = get();
    if (!history.future || history.future.length === 0) return false;

    const nextSnapshot = history.future[0];
    const newFuture = history.future.slice(1);
    const newPast = [
      ...history.past,
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      },
    ].slice(-30);

    set({
      nodes: nextSnapshot.nodes,
      edges: nextSnapshot.edges,
      selectedNode: null,
      history: {
        past: newPast,
        future: newFuture,
      },
    });
    return true;
  },

  canUndo: () => (get().history?.past?.length || 0) > 0,
  canRedo: () => (get().history?.future?.length || 0) > 0,

  // ─── 3. Clipboard & Duplication ───────────────────────────────────────────
  clipboard: [],

  copySelected: () => {
    const { nodes, selectedNode } = get();
    const toCopy = nodes.filter((n) => n.selected || n.id === selectedNode?.id);
    if (toCopy.length === 0) return 0;
    set({ clipboard: JSON.parse(JSON.stringify(toCopy)) });
    return toCopy.length;
  },

  pasteNodes: (offset = { x: 50, y: 50 }) => {
    const { clipboard, nodes } = get();
    if (!clipboard || clipboard.length === 0) return [];
    get().takeSnapshot();

    const timestamp = Date.now();
    const newNodes = clipboard.map((origNode, idx) => {
      const newId = `node_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      return {
        ...origNode,
        id: newId,
        position: {
          x: (origNode.position?.x || 100) + offset.x,
          y: (origNode.position?.y || 100) + offset.y,
        },
        selected: true,
        data: {
          ...origNode.data,
          label: `${origNode.data?.label || origNode.type} (Copy)`,
          _execStatus: undefined,
        },
      };
    });

    const updatedNodes = nodes.map((n) => ({ ...n, selected: false })).concat(newNodes);
    set({
      nodes: updatedNodes,
      selectedNode: newNodes[0] || null,
    });
    return newNodes;
  },

  duplicateNode: (nodeId, offset = { x: 50, y: 50 }) => {
    const { nodes, selectedNode } = get();
    const target = nodes.find((n) => n.id === nodeId) || selectedNode;
    if (!target) return null;
    get().takeSnapshot();

    const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicatedNode = {
      ...target,
      id: newId,
      position: {
        x: (target.position?.x || 100) + offset.x,
        y: (target.position?.y || 100) + offset.y,
      },
      selected: true,
      data: {
        ...target.data,
        label: `${target.data?.label || target.type} (Copy)`,
        _execStatus: undefined,
      },
    };

    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), duplicatedNode],
      selectedNode: duplicatedNode,
    });
    return duplicatedNode;
  },

  selectAllNodes: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, selected: true })),
    }));
  },

  deselectAll: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, selected: false })),
      selectedNode: null,
    }));
  },

  deleteSelectedNodes: () => {
    const { nodes, edges, selectedNode } = get();
    const idsToDelete = new Set(
      nodes.filter((n) => n.selected || n.id === selectedNode?.id).map((n) => n.id)
    );
    if (idsToDelete.size === 0) return 0;
    get().takeSnapshot();

    set({
      nodes: nodes.filter((n) => !idsToDelete.has(n.id)),
      edges: edges.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)),
      selectedNode: null,
    });
    return idsToDelete.size;
  },

  // ─── 4. UI State & Toggles ────────────────────────────────────────────────
  viewport: { x: 0, y: 0, zoom: 1 },
  showAI: false,
  showTemplates: false,
  showMinimap: true,
  showValidationDrawer: false,

  setViewport: (viewport) => set({ viewport }),
  setShowAI: (showAI) => set({ showAI }),
  setShowTemplates: (showTemplates) => set({ showTemplates }),
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
  setShowValidationDrawer: (showValidationDrawer) => set({ showValidationDrawer }),

  // ─── 5. Execution State ───────────────────────────────────────────────────
  executionResult: null,
  running: false,
  saving: false,

  setExecutionResult: (executionResult) => set({ executionResult }),
  setRunning: (running) => set({ running }),
  setSaving: (saving) => set({ saving }),

  // ─── Reset ────────────────────────────────────────────────────────────────
  resetCanvas: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    history: { past: [], future: [] },
    clipboard: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    showAI: false,
    showTemplates: false,
    showMinimap: true,
    showValidationDrawer: false,
    executionResult: null,
    running: false,
    saving: false,
  }),
}));

export default useCanvasStore;

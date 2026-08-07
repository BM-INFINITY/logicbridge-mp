import { create } from 'zustand';

/**
 * Pure UI & Canvas State Store for React Flow Builder
 * Structured into Graph State, UI State, and Execution State
 */
const useCanvasStore = create((set, get) => ({
  // ─── 1. Graph State ────────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  selectedNode: null,
  history: [], // Undo/redo history placeholder

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

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  updateNodeData: (id, data) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    selectedNode: state.selectedNode?.id === id ? { ...state.selectedNode, data: { ...state.selectedNode.data, ...data } } : state.selectedNode,
  })),

  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    selectedNode: state.selectedNode?.id === id ? null : state.selectedNode,
  })),

  // ─── 2. UI State ───────────────────────────────────────────────────────────
  viewport: { x: 0, y: 0, zoom: 1 },
  showAI: false,
  showTemplates: false,

  setViewport: (viewport) => set({ viewport }),
  setShowAI: (showAI) => set({ showAI }),
  setShowTemplates: (showTemplates) => set({ showTemplates }),

  // ─── 3. Execution State ────────────────────────────────────────────────────
  executionResult: null,
  running: false,
  saving: false,

  setExecutionResult: (executionResult) => set({ executionResult }),
  setRunning: (running) => set({ running }),
  setSaving: (saving) => set({ saving }),

  // ─── Reset ─────────────────────────────────────────────────────────────────
  resetCanvas: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    history: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    showAI: false,
    showTemplates: false,
    executionResult: null,
    running: false,
    saving: false,
  }),
}));

export default useCanvasStore;

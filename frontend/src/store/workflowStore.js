import { create } from 'zustand';
import API from '../api/client';

const useWorkflowStore = create((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  isLoading: false,
  error: null,

  fetchWorkflows: async () => {
    set({ isLoading: true });
    try {
      const { data } = await API.get('/api/workflows');
      set({ workflows: data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load', isLoading: false });
    }
  },

  createWorkflow: async (payload) => {
    const { data } = await API.post('/api/workflows', payload);
    set((s) => ({ workflows: [data, ...s.workflows] }));
    return data;
  },

  updateWorkflow: async (id, payload) => {
    const { data } = await API.put(`/api/workflows/${id}`, payload);
    set((s) => ({
      workflows: s.workflows.map((w) => (w._id === id ? data : w)),
      currentWorkflow: data,
    }));
    return data;
  },

  deleteWorkflow: async (id) => {
    await API.delete(`/api/workflows/${id}`);
    set((s) => ({ workflows: s.workflows.filter((w) => w._id !== id) }));
  },

  fetchWorkflow: async (id) => {
    const { data } = await API.get(`/api/workflows/${id}`);
    set({ currentWorkflow: data });
    return data;
  },

  runWorkflow: async (id) => {
    const { data } = await API.post(`/api/workflows/${id}/run`);
    return data;
  },

  generateFromAI: async (prompt) => {
    const { data } = await API.post('/api/workflows/generate', { prompt });
    return data;
  },

  setCurrentWorkflow: (w) => set({ currentWorkflow: w }),
}));

export default useWorkflowStore;

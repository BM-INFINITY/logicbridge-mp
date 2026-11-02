import { create } from 'zustand';
import API from '../api/client';

const useWorkflowStore = create((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  variables: [],
  secrets: [],
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
      variables: data.variables || s.variables,
    }));
    return data;
  },

  deleteWorkflow: async (id) => {
    await API.delete(`/api/workflows/${id}`);
    set((s) => ({ workflows: s.workflows.filter((w) => w._id !== id) }));
  },

  fetchWorkflow: async (id) => {
    const { data } = await API.get(`/api/workflows/${id}`);
    set({
      currentWorkflow: data,
      variables: data.variables || [],
    });
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

  setCurrentWorkflow: (w) => set({ currentWorkflow: w, variables: w?.variables || [] }),

  // ── Workflow Variables Actions ──────────────────────────────────────────
  fetchVariables: async (workflowId) => {
    if (!workflowId) return [];
    try {
      const { data } = await API.get(`/api/workflows/${workflowId}/variables`);
      set({ variables: data });
      return data;
    } catch (err) {
      console.error('Failed to fetch variables', err);
      return [];
    }
  },

  createVariable: async (workflowId, payload) => {
    const { data } = await API.post(`/api/workflows/${workflowId}/variables`, payload);
    set((s) => ({ variables: [...s.variables, data] }));
    return data;
  },

  updateVariable: async (workflowId, varId, payload) => {
    const { data } = await API.put(`/api/workflows/${workflowId}/variables/${varId}`, payload);
    set((s) => ({
      variables: s.variables.map((v) => (v._id === varId ? data : v)),
    }));
    return data;
  },

  deleteVariable: async (workflowId, varId) => {
    await API.delete(`/api/workflows/${workflowId}/variables/${varId}`);
    set((s) => ({
      variables: s.variables.filter((v) => v._id !== varId),
    }));
  },

  // ── Workflow Secrets Actions ────────────────────────────────────────────
  fetchSecrets: async (workflowId) => {
    if (!workflowId) return [];
    try {
      const { data } = await API.get(`/api/workflows/${workflowId}/secrets`);
      set({ secrets: data });
      return data;
    } catch (err) {
      console.error('Failed to fetch secrets', err);
      return [];
    }
  },

  createSecret: async (workflowId, payload) => {
    const { data } = await API.post(`/api/workflows/${workflowId}/secrets`, payload);
    set((s) => ({ secrets: [...s.secrets, data] }));
    return data;
  },

  updateSecret: async (workflowId, secretId, payload) => {
    const { data } = await API.put(`/api/workflows/${workflowId}/secrets/${secretId}`, payload);
    set((s) => ({
      secrets: s.secrets.map((sItem) => (sItem._id === secretId ? data : sItem)),
    }));
    return data;
  },

  deleteSecret: async (workflowId, secretId) => {
    await API.delete(`/api/workflows/${workflowId}/secrets/${secretId}`);
    set((s) => ({
      secrets: s.secrets.filter((sItem) => sItem._id !== secretId),
    }));
  },

  setVariables: (variables) => set({ variables }),
  setSecrets: (secrets) => set({ secrets }),
}));

export default useWorkflowStore;

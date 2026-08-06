import { create } from 'zustand';
import API from '../api/client';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('lb_token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await API.post('/api/auth/login', { email, password });
      localStorage.setItem('lb_token', data.token);
      set({ user: data, token: data.token, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await API.post('/api/auth/register', { name, email, password });
      localStorage.setItem('lb_token', data.token);
      set({ user: data, token: data.token, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await API.get('/api/auth/me');
      set({ user: data });
    } catch {
      localStorage.removeItem('lb_token');
      set({ user: null, token: null });
    }
  },

  logout: () => {
    localStorage.removeItem('lb_token');
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;

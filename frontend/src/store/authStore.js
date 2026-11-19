import { create } from 'zustand';
import API from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('lb_token') || null,
  refreshToken: localStorage.getItem('lb_refresh_token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await API.post('/api/auth/login', { email, password });
      const data = res.data?.data || res.data;
      const user = data.user || data;
      const token = data.token || data.accessToken;
      const refreshToken = data.refreshToken;

      localStorage.setItem('lb_token', token);
      if (refreshToken) {
        localStorage.setItem('lb_refresh_token', refreshToken);
      }

      set({ user, token, refreshToken, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await API.post('/api/auth/register', { name, email, password });
      const data = res.data?.data || res.data;
      const user = data.user || data;
      const token = data.token || data.accessToken;
      const refreshToken = data.refreshToken;

      localStorage.setItem('lb_token', token);
      if (refreshToken) {
        localStorage.setItem('lb_refresh_token', refreshToken);
      }

      set({ user, token, refreshToken, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const res = await API.get('/api/auth/me');
      const user = res.data?.data || res.data;
      set({ user });
    } catch {
      localStorage.removeItem('lb_token');
      localStorage.removeItem('lb_refresh_token');
      set({ user: null, token: null, refreshToken: null });
    }
  },

  logout: async () => {
    try {
      const refreshToken = get().refreshToken || localStorage.getItem('lb_refresh_token');
      if (refreshToken) {
        await API.post('/api/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('lb_token');
      localStorage.removeItem('lb_refresh_token');
      set({ user: null, token: null, refreshToken: null });
    }
  },

  isAdmin: () => {
    const role = get().user?.role;
    return role === 'admin';
  },

  isApprover: () => {
    const role = get().user?.role;
    return role === 'admin' || role === 'approver';
  },

  hasRole: (requiredRole) => {
    const role = get().user?.role;
    if (!role) return false;
    if (role === 'admin') return true;
    return role === requiredRole;
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;

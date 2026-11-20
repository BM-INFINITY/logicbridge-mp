import axios from 'axios';
import { parseApiError, showErrorToast } from '../utils/errorHandler';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Attach JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('lb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: handles 401 session expiration and 403 authorization failures
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Attach parsed error metadata
    error.parsed = parseApiError(error);

    // Handle 403 Forbidden (authorization failure)
    if (status === 403) {
      showErrorToast(error, 'Access Denied: You do not have permission to perform this action.');
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized (session expired or revoked)
    if (status === 401 && originalRequest && !originalRequest._retry) {
      const isAuthRoute =
        originalRequest.url?.includes('/api/auth/login') ||
        originalRequest.url?.includes('/api/auth/register') ||
        originalRequest.url?.includes('/api/auth/refresh');

      if (isAuthRoute) {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('lb_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('lb_token');
        localStorage.removeItem('lb_refresh_token');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return API(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
          { refreshToken }
        );

        const newAccessToken =
          data?.data?.token || data?.token || data?.data?.accessToken || data?.accessToken;
        const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('lb_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('lb_refresh_token', newRefreshToken);
          }
          API.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return API(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('lb_token');
        localStorage.removeItem('lb_refresh_token');
        showErrorToast('Session expired or revoked. Please log in again.');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;

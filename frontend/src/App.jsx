import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BuilderPage from './pages/BuilderPage';
import LogsPage from './pages/LogsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import './index.css';

function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { token } = useAuthStore();
  return !token ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { token, fetchMe } = useAuthStore();

  useEffect(() => {
    if (token) fetchMe();
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2332',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.07)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/builder" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
        <Route path="/builder/:id" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

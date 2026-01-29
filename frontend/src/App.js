import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './api/AuthContext';
import { WebSocketProvider } from './api/WebSocketContext';
import { Toaster } from 'sonner';
import './App.css';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardLayout from './pages/DashboardLayout';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import AboutUs from './pages/AboutUs';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace /> : <SignupPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/about" element={<AboutUs />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            user && user.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/*"
          element={
            user && user.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <div className="App">
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </div>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
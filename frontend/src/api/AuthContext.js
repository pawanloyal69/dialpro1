import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setTokens, clearTokens, getAccessToken } from './client';

const AuthContext = createContext();

// Request microphone permission - ALWAYS request after login
const requestMicrophonePermission = async () => {
  try {
    // Request permission by getting user media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop immediately after getting permission
    localStorage.setItem('mic_permission', 'granted');
    console.log('Microphone permission granted');
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    localStorage.setItem('mic_permission', 'denied');
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [micPermission, setMicPermission] = useState(localStorage.getItem('mic_permission') || 'unknown');

  useEffect(() => {
    // Try to restore user from localStorage
    const storedUser = localStorage.getItem('user');
    const token = getAccessToken();
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      api.get('/auth/me').then(response => {
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      }).catch(() => {
        clearTokens();
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const response = await api.post('/auth/login', { identifier, password });
    const { user: userData, access_token, refresh_token } = response.data;
    setTokens(access_token, refresh_token);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // ALWAYS request microphone permission immediately after login
    const granted = await requestMicrophonePermission();
    setMicPermission(granted ? 'granted' : 'denied');
    
    return userData;
  };

  const signup = async (data) => {
    const response = await api.post('/auth/signup', data);
    const { user: userData, access_token, refresh_token } = response.data;
    setTokens(access_token, refresh_token);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // ALWAYS request microphone permission immediately after signup
    const granted = await requestMicrophonePermission();
    setMicPermission(granted ? 'granted' : 'denied');
    
    return userData;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    // Don't clear mic permission on logout - it's a browser-level setting
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser, micPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
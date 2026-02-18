import React, { createContext, useState, useEffect, useContext } from 'react';
import { validateToken, clearAuthToken } from '../utils/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      const userData = validateToken();
      setUser(userData);
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = (userData, token) => {
    if (!userData || !token || !userData.id || !userData.role) {
      throw new Error('Invalid authentication data');
    }
    localStorage.setItem('auth_token', token);
    setUser(userData);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

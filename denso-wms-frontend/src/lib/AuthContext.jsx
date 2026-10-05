import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { onAuthExpired, } from '@/api/client';
import { clearTokens, getTokens } from '@/api/tokens';
import { safeReturnTo } from '@/lib/authReturnTo';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getTokens()?.accessToken) {
        setIsBootstrapping(false);
        return;
      }
      try {
        const me = await api.auth.me();
        if (!cancelled) setUser(me);
      } catch {
        clearTokens();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onAuthExpired(() => {
      setUser(null);
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      const data = await api.auth.login(email, password);
      setUser(data.user);
      navigate(safeReturnTo(), { replace: true });
    },
    [navigate],
  );

  const register = useCallback(
    async (email, password, fullName) => {
      setError(null);
      const data = await api.auth.register(email, password, fullName);
      setUser(data.user);
      navigate(safeReturnTo(), { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const forgotPassword = useCallback((email) => api.auth.forgotPassword(email), []);
  const resetPassword = useCallback(
    (token, newPassword) => api.auth.resetPassword(token, newPassword),
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isBootstrapping,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

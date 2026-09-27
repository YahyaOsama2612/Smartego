import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import authApi from '../api/authApi';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('smartego_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('smartego_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize unauthorized events across application
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('smartego:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('smartego:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password, remember = true }) => {
    setIsLoading(true);
    try {
      const result = await authApi.login({ email, password });
      
      const authToken = result.token || 'demo-admin-token';
      const authUser = result.user || { email, role: 'Admin' };

      setToken(authToken);
      setUser(authUser);

      if (remember) {
        localStorage.setItem('smartego_token', authToken);
        localStorage.setItem('smartego_user', JSON.stringify(authUser));
      } else {
        sessionStorage.setItem('smartego_token', authToken);
        sessionStorage.setItem('smartego_user', JSON.stringify(authUser));
      }

      return { success: true, user: authUser, token: authToken };
    } catch (err) {
      let errorMessage = 'An error occurred during login. Please try again.';
      let fieldErrors = {};

      if (err.response) {
        const data = err.response.data;
        if (data.errors) {
          fieldErrors = data.errors;
        }
        if (data.message) {
          errorMessage = data.message;
        } else if (err.response.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (err.response.status === 422) {
          errorMessage = 'Please check the required fields.';
        }
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      }

      const errorObj = new Error(errorMessage);
      errorObj.fieldErrors = fieldErrors;
      errorObj.status = err.response?.status;
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Demo login helper for instant evaluation/development
   */
  const loginDemo = useCallback(() => {
    const demoUser = {
      id: 1,
      name: 'Admin Supervisor',
      email: 'admin@smartego.com',
      role: 'Super Administrator',
    };
    const demoToken = 'smartego-demo-admin-token-' + Date.now();
    setToken(demoToken);
    setUser(demoUser);
    localStorage.setItem('smartego_token', demoToken);
    localStorage.setItem('smartego_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser, token: demoToken };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('smartego_token');
      localStorage.removeItem('smartego_user');
      sessionStorage.removeItem('smartego_token');
      sessionStorage.removeItem('smartego_user');
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      loginDemo,
      logout,
    }),
    [token, user, isLoading, login, loginDemo, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

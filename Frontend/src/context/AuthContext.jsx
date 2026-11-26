import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

const readSavedUser = () => {
  try {
    const saved = localStorage.getItem('shortlet_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Older sessions stored "Host"/"Guest"; roles are lower-case everywhere now.
    return parsed ? { ...parsed, role: (parsed.role || '').toLowerCase() } : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  // Read the saved session synchronously, so protected pages don't see "logged out" on first render
  // and redirect to /login after a page refresh.
  const [token, setToken] = useState(() => localStorage.getItem('shortlet_token'));
  const [user, setUser] = useState(() => (localStorage.getItem('shortlet_token') ? readSavedUser() : null));

  const login = (userData, jwtToken) => {
    const normalised = { ...userData, role: (userData.role || '').toLowerCase() };
    setToken(jwtToken);
    setUser(normalised);
    localStorage.setItem('shortlet_token', jwtToken);
    localStorage.setItem('shortlet_user', JSON.stringify(normalised));
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('shortlet_token');
    localStorage.removeItem('shortlet_user');
  }, []);

  // api.js fires this when the server rejects the token (expired, etc.)
  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  /** Re-reads the profile from the API (email confirmed? role changed?) and updates the saved session. */
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('shortlet_token')) return;
    try {
      const { data } = await api.get('/Auth/me');
      setUser((current) => {
        const next = {
          ...current,
          id: data.userId, name: data.name, email: data.email,
          role: (data.role || '').toLowerCase(), emailConfirmed: data.emailConfirmed,
          verificationStatus: data.verificationStatus,
        };
        localStorage.setItem('shortlet_user', JSON.stringify(next));
        return next;
      });
    } catch { /* offline or token expired (api.js logs out on 401) */ }
  }, []);

  // Refresh once per app load so long-lived sessions pick up changes.
  useEffect(() => {
    const t = setTimeout(refreshUser, 0); // after first paint; never blocks rendering
    return () => clearTimeout(t);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Case-insensitive role check: hasRole(user, 'host') */
export const hasRole = (user, role) => (user?.role || '').toLowerCase() === role;

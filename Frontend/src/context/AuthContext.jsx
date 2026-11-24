import React, { createContext, useState, useEffect, useCallback } from 'react';

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

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Case-insensitive role check: hasRole(user, 'host') */
export const hasRole = (user, role) => (user?.role || '').toLowerCase() === role;

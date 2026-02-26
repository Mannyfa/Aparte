import React, { createContext, useState, useEffect } from 'react';

// Create the Context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // When the app first loads, check if we have a token saved in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('shortlet_token');
    const savedUser = localStorage.getItem('shortlet_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // The login function we will call when the API responds with 200 Success
  const login = (userData, jwtToken) => {
    setToken(jwtToken);
    setUser(userData);
    localStorage.setItem('shortlet_token', jwtToken);
    localStorage.setItem('shortlet_user', JSON.stringify(userData));
  };

  // The logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('shortlet_token');
    localStorage.removeItem('shortlet_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};
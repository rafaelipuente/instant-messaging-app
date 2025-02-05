import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken } from '../utils/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    const user = getAuthToken();
    setAuthUser(user);
  }, []);

  const updateAuthUser = (user) => {
    setAuthUser(user);
  };

  return (
    <AuthContext.Provider value={{ authUser, updateAuthUser }}>
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

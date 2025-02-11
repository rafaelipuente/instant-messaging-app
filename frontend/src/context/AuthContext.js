import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getFullProfilePictureUrl = (profilePicture) => {
  if (!profilePicture) return null;
  return profilePicture.startsWith('http') 
    ? profilePicture 
    : `${API_BASE_URL.replace('/api', '')}${profilePicture}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.profilePicture) {
          userData.profilePicture = getFullProfilePictureUrl(userData.profilePicture);
        }
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    try {
      if (!userData || !userData._id || !userData.username || !userData.token) {
        console.error('Invalid user data:', userData);
        throw new Error('Invalid user data');
      }

      if (userData.profilePicture) {
        userData.profilePicture = getFullProfilePictureUrl(userData.profilePicture);
      }

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error in login:', error);
      throw error;
    }
  };

  const logout = () => {
    try {
      setUser(null);
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Error in logout:', error);
    }
  };

  const updateUser = (userData) => {
    try {
      if (!userData || !userData._id || !userData.username) {
        console.error('Invalid user data:', userData);
        throw new Error('Invalid user data');
      }

      if (userData.profilePicture) {
        userData.profilePicture = getFullProfilePictureUrl(userData.profilePicture);
      }

      const updatedUserData = { ...userData, token: user?.token };
      setUser(updatedUserData);
      localStorage.setItem('user', JSON.stringify(updatedUserData));
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    getFullProfilePictureUrl
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

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
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (userData) => {
    try {
      if (!userData || !userData._id || !userData.username || !userData.token) {
        console.error('Invalid user data:', userData);
        throw new Error('Invalid user data');
      }

      if (userData.profilePicture) {
        userData.profilePicture = getFullProfilePictureUrl(userData.profilePicture);
      }

      setUser({
        ...userData,
        openChats: userData.openChats || []
      });
    } catch (error) {
      console.error('Error in login:', error);
      throw error;
    }
  };

  const logout = () => {
    try {
      setUser(null);
      setNotifications([]);
      setUnreadMessages({});
    } catch (error) {
      console.error('Error in logout:', error);
    }
  };

  const updateUser = (updates) => {
    try {
      if (!updates || !updates._id || !updates.username) {
        console.error('Invalid user data:', updates);
        throw new Error('Invalid user data');
      }

      if (updates.profilePicture) {
        updates.profilePicture = getFullProfilePictureUrl(updates.profilePicture);
      }

      setUser(prev => ({
        ...prev,
        ...updates
      }));
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  };

  const updateOpenChats = (newOpenChats) => {
    setUser(prev => ({
      ...prev,
      openChats: newOpenChats
    }));
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const addUnreadMessage = (senderId, messageId) => {
    setUnreadMessages(prev => ({
      ...prev,
      [senderId]: [...(prev[senderId] || []), messageId]
    }));
  };

  const clearUnreadMessages = (senderId) => {
    setUnreadMessages(prev => {
      const newState = { ...prev };
      delete newState[senderId];
      return newState;
    });
  };

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

  const value = {
    user,
    login,
    logout,
    updateUser,
    updateOpenChats,
    loading,
    getFullProfilePictureUrl,
    notifications,
    addNotification,
    clearNotifications,
    markNotificationAsRead,
    unreadMessages,
    addUnreadMessage,
    clearUnreadMessages
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

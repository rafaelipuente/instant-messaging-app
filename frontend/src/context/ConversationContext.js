import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';

// Create the context
const ConversationContext = createContext(null);

export const useConversations = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
};

export const ConversationProvider = ({ children }) => {
  const { user } = useAuth();
  const { connected, emitEvent, onEvent } = useSocket();
  const [channels, setChannels] = useState([]);
  const [directConversations, setDirectConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default channels
  const defaultChannels = [
    { id: 'general', name: 'General', icon: '🌐', isDefaultChannel: true },
    { id: 'tech-talk', name: 'Tech Talk', icon: '💻', isDefaultChannel: true },
    { id: 'random', name: 'Random', icon: '🎲', isDefaultChannel: true },
    { id: 'music', name: 'Music', icon: '🎵', isDefaultChannel: true }
  ];

  // Function to fetch channels
  const fetchChannels = useCallback(async () => {
    if (!user?.token) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/conversations?type=channel`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      
      const data = await response.json();
      
      // Ensure default channels are always present
      const allChannels = [...defaultChannels];
      
      // Add any custom channels from the database
      data.forEach(channel => {
        // Skip any channels with name "genral" (likely misspelled)
        if (channel.name.toLowerCase() === 'genral') {
          return;
        }
        
        if (!allChannels.some(c => c.id === channel._id)) {
          allChannels.push({
            id: channel._id,
            name: channel.name,
            icon: channel.icon || '💬',
            isDefaultChannel: channel.isDefaultChannel
          });
        }
      });
      
      setChannels(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      // Fall back to default channels
      setChannels(defaultChannels);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  // Function to fetch direct conversations
  const fetchDirectConversations = useCallback(async () => {
    if (!user?.token) return;
    
    try {
      setLoading(true);
      
      // Use the correct API endpoint for direct messages
      // The endpoint is now consolidated in messageRoutes.js
      const response = await fetch(`${API_BASE_URL}/messages/direct/conversations`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch direct conversations');
      }
      
      const data = await response.json();
      console.log('Fetched direct conversations:', data);
      
      // Transform the data into the expected format if needed
      // The response is now a direct array of conversations
      const conversations = Array.isArray(data) ? data : [];
      
      // Make sure each conversation has the required fields
      const formattedConversations = conversations.map(conv => ({
        _id: conv._id,
        username: conv.otherUser?.username || 'Unknown',
        profilePicture: conv.otherUser?.profilePicture || null,
        status: conv.otherUser?.status || 'offline',
        unreadCount: conv.unreadCount || 0,
        lastViewedAt: conv.lastViewedAt
      }));
      
      setDirectConversations(formattedConversations);
    } catch (error) {
      console.error('Error fetching direct conversations:', error);
      // If we fail, keep current conversations
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  // Function to fetch available users
  const fetchUsers = useCallback(async () => {
    if (!user?.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/list`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.filter(u => u._id !== user._id)); // Exclude current user
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [user?.token]);

  // Function to start a direct conversation
  const startDirectConversation = useCallback(async (userId) => {
    if (!user?.token || !userId) return null;
    
    try {
      // Check if conversation already exists
      const existing = directConversations.find(c => 
        c._id === userId || c.userId === userId
      );
      
      if (existing) {
        console.log('Using existing conversation:', existing);
        // Move to top of list if needed by removing and adding back
        setDirectConversations(prevConversations => [
          existing, 
          ...prevConversations.filter(c => c._id !== existing._id)
        ]);
        return existing;
      }
      
      // Create new conversation
      const response = await fetch(`${API_BASE_URL}/direct-messages/${userId}`, {
        method: 'GET', // This endpoint creates if not exists
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }
      
      const newConversation = await response.json();
      console.log('Created new conversation:', newConversation);
      
      // Add to state at the beginning of the array (most recent)
      setDirectConversations(prevConversations => {
        // Remove if already exists
        const filtered = prevConversations.filter(c => c._id !== newConversation._id);
        // Add to beginning (most recent)
        return [newConversation, ...filtered];
      });
      
      return newConversation;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
      return null;
    }
  }, [user?.token]);

  // Function to create a new channel
  const createChannel = useCallback(async (channelName) => {
    if (!user?.token || !channelName.trim()) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: channelName.trim(),
          type: 'channel'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create channel');
      }
      
      const newChannel = await response.json();
      
      // Add to state
      setChannels(prev => [
        ...prev,
        {
          id: newChannel._id,
          name: newChannel.name,
          icon: newChannel.icon || '💬',
          isDefaultChannel: false
        }
      ]);
      
      toast.success('Channel created successfully!');
      return newChannel;
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Failed to create channel');
      return null;
    }
  }, [user?.token]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!connected) return;
    
    // Handler for new conversation notifications
    const handleNewConversation = (conversation) => {
      if (conversation.type === 'channel') {
        setChannels(prev => {
          if (prev.some(c => c.id === conversation._id)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: conversation._id,
              name: conversation.name,
              icon: conversation.icon || '💬',
              isDefaultChannel: conversation.isDefaultChannel
            }
          ];
        });
      } else if (conversation.type === 'direct') {
        setDirectConversations(prev => {
          if (prev.some(c => c._id === conversation._id)) {
            return prev;
          }
          return [...prev, conversation];
        });
      }
    };
    
    // Set up event listeners
    const cleanup = onEvent('newConversation', handleNewConversation);
    
    // Initial data fetch
    fetchChannels();
    fetchDirectConversations();
    fetchUsers();
    
    return cleanup;
  }, [connected, onEvent, fetchChannels, fetchDirectConversations, fetchUsers]);

  return (
    <ConversationContext.Provider value={{
      channels,
      directConversations,
      users,
      loading,
      fetchChannels,
      fetchDirectConversations,
      fetchUsers,
      startDirectConversation,
      createChannel
    }}>
      {children}
    </ConversationContext.Provider>
  );
};

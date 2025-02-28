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
  const { connected, onEvent } = useSocket();
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
      console.log('Fetching channels...');
      
      const response = await fetch(`${API_BASE_URL}/conversations?type=channel`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      
      const data = await response.json();
      console.log('Received channels data:', data);
      
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
      
      console.log('Setting channels:', allChannels);
      setChannels(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      // Fall back to default channels
      console.log('Falling back to default channels:', defaultChannels);
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
      console.log('Fetching users...');
      const response = await fetch(`${API_BASE_URL}/users/list`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      
      // Filter out current user
      const filteredUsers = data.filter(u => u._id !== user._id);
      console.log('Received users data:', filteredUsers);
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [user]);

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
        setDirectConversations(prevConversations => {
          const updatedConversations = [
            existing, 
            ...prevConversations.filter(c => c._id !== existing._id)
          ];
          
          // Save to localStorage for persistence
          localStorage.setItem('openDirectConversations', JSON.stringify(updatedConversations));
          
          return updatedConversations;
        });
        
        return existing;
      }
      
      // Try to find an existing direct message conversation or create one
      console.log(`Attempting to start conversation with user ID: ${userId}`);
      
      // Use the correct API endpoint for messages
      const response = await fetch(`${API_BASE_URL}/messages/direct/${userId}`, {
        method: 'POST', // POST to create a new conversation
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Hello! I started a new conversation.' // Send an initial message
        })
      });
      
      if (!response.ok) {
        console.error(`API error: ${response.status} - ${response.statusText}`);
        throw new Error(`Failed to start conversation: ${response.status}`);
      }
      
      const messageData = await response.json();
      console.log('Created new conversation via message:', messageData);
      
      // Use the recipient information to create a conversation object
      const otherUser = users.find(u => u._id === userId);
      if (!otherUser) {
        console.error('Could not find user details for:', userId);
        toast.error('Could not find user details');
        return null;
      }
      
      const newConversation = {
        _id: userId, // Use the user ID as the conversation ID for direct messages
        username: otherUser.username,
        profilePicture: otherUser.profilePicture,
        status: otherUser.status || 'offline',
        unreadCount: 0,
        lastMessage: messageData
      };
      
      console.log('Created new conversation object:', newConversation);
      
      // Add to state at the beginning of the array (most recent)
      setDirectConversations(prevConversations => {
        // Remove if already exists
        const filtered = prevConversations.filter(c => c._id !== newConversation._id);
        // Add to beginning (most recent)
        const updated = [newConversation, ...filtered];
        
        // Save to localStorage for persistence
        localStorage.setItem('openDirectConversations', JSON.stringify(updated));
        
        // Log the update
        console.log('Updated direct conversations with new one:', updated);
        
        return updated;
      });
      
      toast.success(`Started conversation with ${otherUser.username}`);
      return newConversation;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error(`Failed to start conversation: ${error.message}`);
      return null;
    }
  }, [user?.token, directConversations, users]);

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

  // Fetch data when user is logged in and socket is connected
  useEffect(() => {
    const loadData = async () => {
      if (user?.token) {
        await Promise.all([
          fetchChannels(),
          fetchDirectConversations(),
          fetchUsers()
        ]);
        
        // Load open direct conversations from localStorage
        try {
          const savedConversations = localStorage.getItem('openDirectConversations');
          if (savedConversations) {
            const parsed = JSON.parse(savedConversations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('Loaded saved direct conversations from localStorage:', parsed);
              setDirectConversations(prev => {
                // Merge with any new conversations fetched from the server
                const existingIds = new Set(parsed.map(c => c._id));
                const newOnes = prev.filter(c => !existingIds.has(c._id));
                return [...parsed, ...newOnes];
              });
            }
          }
        } catch (error) {
          console.error('Error loading saved conversations:', error);
        }
      }
    };
    
    loadData();
  }, [user?.token, fetchChannels, fetchDirectConversations, fetchUsers]);

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
    
    return cleanup;
  }, [connected, onEvent]);

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

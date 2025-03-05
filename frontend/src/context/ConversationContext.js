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

  // Default channels - ensure consistent naming with backend
  // IMPORTANT: The 'id' should match the channel name in the database (lowercase with hyphens)
  // while the 'name' is the display name (properly capitalized)
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
        },
        credentials: 'include'
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
        
        // Check if this is one of our default channels by name
        const isDefaultChannel = defaultChannels.some(dc => dc.id === channel.name);
        
        if (isDefaultChannel) {
          // This is a default channel - use the predefined ID (channel name) for consistency
          // Update any fields from the server version
          const defaultChannel = defaultChannels.find(dc => dc.id === channel.name);
          if (defaultChannel) {
            // Update the default channel with server data if available
            // but keep the consistent ID
            defaultChannel._id = channel._id;
            defaultChannel.icon = channel.icon || defaultChannel.icon;
          }
        } else if (!allChannels.some(c => c.id === channel._id)) {
          // This is a custom channel - add it to the list
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
        },
        credentials: 'include'
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
        },
        credentials: 'include'
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
      // First, check if conversation already exists by user ID
      // We need to check both the _id and userId fields since we may have stored
      // conversations in different formats
      const existingByUserId = directConversations.find(c => 
        c.userId === userId ||
        (c.otherUser && c.otherUser._id === userId)
      );
      
      // Also check if we have a dm_ format conversation that matches this user
      // This supports the new consistent ID format
      const existingByDmFormat = directConversations.find(c => {
        // Check if this is a direct message conversation ID
        if (c._id && typeof c._id === 'string' && c._id.startsWith('dm_')) {
          // Extract the user IDs from the dm_ format
          const parts = c._id.split('_');
          if (parts.length === 3) {
            // Check if either user ID matches our target
            return parts[1] === userId || parts[2] === userId;
          }
        }
        return false;
      });
      
      const existing = existingByUserId || existingByDmFormat;
      
      if (existing) {
        console.log('Using existing conversation:', existing);
        // Move to top of list if needed by removing and adding back
        setDirectConversations(prevConversations => {
          const updatedConversations = [
            existing, 
            ...prevConversations.filter(c => c._id !== existing._id)
          ];
          
          // Save to localStorage for persistence
          localStorage.setItem('openChats', JSON.stringify(updatedConversations));
          
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
          // Instead of a default message, we'll just initiate the conversation
          // without any starter message
          startConversation: true
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error(`API error: ${response.status} - ${response.statusText}`);
        throw new Error(`Failed to start conversation: ${response.status}`);
      }
      
      const messageData = await response.json();
      console.log('Created new conversation:', messageData);
      
      // Extract the conversation ID from the response
      // The backend creates conversation IDs in format: dm_userId1_userId2
      const conversationId = messageData.conversationId || messageData._id;
      
      if (!conversationId) {
        console.error('No conversation ID in response:', messageData);
        toast.error('Failed to create conversation');
        return null;
      }
      
      console.log('Extracted conversation ID:', conversationId);
      
      // Use the recipient information to create a conversation object
      const otherUser = users.find(u => u._id === userId);
      if (!otherUser) {
        console.error('Could not find user details for:', userId);
        toast.error('Could not find user details');
        return null;
      }
      
      // Create a conversation object, handling cases where there's no initial message
      const newConversation = {
        _id: conversationId, // Use the actual conversation ID from the server
        userId: userId,       // Store the user ID separately for reference
        username: otherUser.username,
        profilePicture: otherUser.profilePicture,
        status: otherUser.status || 'offline',
        unreadCount: 0,
        // Only set lastMessage if we received a message in the response
        lastMessage: messageData._id ? messageData : null, 
        // Store the receiverId for easier message sending
        receiverId: userId,
        // Include empty conversation flag to indicate no messages yet
        emptyConversation: !messageData._id 
      };
      
      console.log('Created new conversation object:', newConversation);
      
      // Add to state at the beginning of the array (most recent)
      setDirectConversations(prevConversations => {
        // Remove any existing conversations with this user or ID
        const filtered = prevConversations.filter(c => 
          c._id !== newConversation._id && 
          c.userId !== userId &&
          (c.otherUser?._id !== userId)
        );
        // Add to beginning (most recent)
        const updated = [newConversation, ...filtered];
        
        // Save to localStorage for persistence
        localStorage.setItem('openChats', JSON.stringify(updated));
        
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

  // Function to remove a conversation from recent conversations list
  const removeConversation = useCallback(async (userId) => {
    if (!userId || !user?.token) return;
    
    console.log(`Removing conversation with user ID: ${userId} from recent conversations`);
    
    try {
      // Log the API call we're making for debugging
      const url = `${API_BASE_URL}/users/open-chats/${userId}`;
      console.log('Making API call to:', url);
      
      // Call API to delete messages for this conversation
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Failed to delete conversation messages: ${response.status} ${response.statusText}`);
      }
      
      // Update state
      setDirectConversations(prevConversations => {
        // Filter out the conversation to remove
        const updatedConversations = prevConversations.filter(c => c._id !== userId);
        
        // Save to localStorage for persistence
        localStorage.setItem('openChats', JSON.stringify(updatedConversations));
        
        return updatedConversations;
      });
      
      console.log('Successfully deleted conversation and messages');
    } catch (error) {
      console.error('Error removing conversation:', error);
      toast.error('Failed to completely remove conversation');
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
        }),
        credentials: 'include'
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
          const savedConversations = localStorage.getItem('openChats');
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
    
    // Handler for receiving the list of online users
    const handleOnlineUsers = (onlineUserList) => {
      console.log('Online users received:', onlineUserList);
      if (!Array.isArray(onlineUserList)) return;
      
      setUsers(prev => {
        // Update status of existing users based on online users list
        const updatedUsers = prev.map(u => {
          const isOnline = onlineUserList.some(ou => ou.userId === u._id);
          return isOnline ? { ...u, status: 'online' } : u;
        });
        
        // Add any new online users not already in our list
        onlineUserList.forEach(ou => {
          if (!updatedUsers.some(u => u._id === ou.userId) && ou.userId !== user?._id) {
            updatedUsers.push({
              _id: ou.userId,
              username: ou.username,
              status: 'online',
              profilePicture: null
            });
          }
        });
        
        return updatedUsers;
      });
    };
    
    // Handler for when a user connects
    const handleUserConnected = (data) => {
      console.log('User connected:', data);
      if (!data || !data.userId) return;
      
      setUsers(prev => {
        // Check if user already exists in our list
        const userExists = prev.some(u => u._id === data.userId);
        
        if (userExists) {
          // Update existing user's status
          return prev.map(u => 
            u._id === data.userId ? { ...u, status: 'online' } : u
          );
        } else if (data.username && data.userId !== user?._id) {
          // Add new user if not already in the list and not the current user
          return [...prev, {
            _id: data.userId,
            username: data.username,
            status: 'online',
            profilePicture: data.profilePicture || null
          }];
        }
        return prev;
      });
    };
    
    // Handler for when a user disconnects
    const handleUserDisconnected = (data) => {
      console.log('User disconnected:', data);
      if (!data || !data.userId) return;
      
      setUsers(prev => {
        return prev.map(u => 
          u._id === data.userId ? { ...u, status: 'offline' } : u
        );
      });
    };
    
    // Set up event listeners
    const cleanupFunctions = [
      onEvent('newConversation', handleNewConversation),
      onEvent('userConnected', handleUserConnected),
      onEvent('userDisconnected', handleUserDisconnected),
      onEvent('onlineUsers', handleOnlineUsers)
    ];
    
    // Return cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [connected, onEvent, user?._id]);

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
      createChannel,
      removeConversation
    }}>
      {children}
    </ConversationContext.Provider>
  );
};

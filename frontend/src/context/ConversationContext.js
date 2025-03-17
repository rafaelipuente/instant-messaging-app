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
  const { socket, connected } = useSocket(); // Updated to use socket and connected directly
  const [channels, setChannels] = useState([]);
  const [directConversations, setDirectConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default channels - ensure consistent naming with backend
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
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received channels data:', data);

      // Ensure default channels are always present
      const allChannels = [...defaultChannels];

      // Add any custom channels from the database
      data.forEach(channel => {
        if (channel.name.toLowerCase() === 'genral') {
          return;
        }

        const isDefaultChannel = defaultChannels.some(dc => dc.id === channel.name);

        if (isDefaultChannel) {
          const defaultChannel = allChannels.find(dc => dc.id === channel.name);
          if (defaultChannel) {
            defaultChannel._id = channel._id;
            defaultChannel.icon = channel.icon || defaultChannel.icon;
          }
        } else if (!allChannels.some(c => c.id === channel._id)) {
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
      toast.error('Failed to load channels');
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

      const response = await fetch(`${API_BASE_URL}/messages/direct/conversations`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch direct conversations: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched direct conversations:', data);

      const conversations = Array.isArray(data) ? data : [];

      // Add standardConversationId for room joining
      const formattedConversations = conversations.map(conv => {
        const otherUserId = conv.otherUser?._id;
        const sortedIds = [user._id, otherUserId].sort();
        return {
          _id: conv._id,
          userId: otherUserId,
          username: conv.otherUser?.username || 'Unknown',
          profilePicture: conv.otherUser?.profilePicture || null,
          status: conv.otherUser?.status || 'offline',
          unreadCount: conv.unreadCount || 0,
          lastViewedAt: conv.lastViewedAt,
          standardConversationId: `dm_${sortedIds[0]}_${sortedIds[1]}` // Added for room joining
        };
      });

      setDirectConversations(formattedConversations);
    } catch (error) {
      console.error('Error fetching direct conversations:', error);
      toast.error('Failed to load direct conversations');
    } finally {
      setLoading(false);
    }
  }, [user?.token, user?._id]);

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
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const filteredUsers = data.filter(u => u._id !== user._id);
      console.log('Received users data:', filteredUsers);

      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  }, [user]);

  // Function to start a direct conversation
  const startDirectConversation = useCallback(async (userId) => {
    if (!user?.token || !userId) return null;

    try {
      const existing = directConversations.find(c =>
        c.userId === userId ||
        (c.otherUser && c.otherUser._id === userId) ||
        (c._id && typeof c._id === 'string' && c._id.startsWith('dm_') &&
          c._id.split('_').slice(1).includes(userId))
      );

      if (existing) {
        console.log('Using existing conversation:', existing);
        setDirectConversations(prev => {
          const updated = [
            existing,
            ...prev.filter(c => c._id !== existing._id)
          ];
          localStorage.setItem('openChats', JSON.stringify(updated));
          return updated;
        });
        return existing;
      }

      console.log(`Attempting to start conversation with user ID: ${userId}`);

      const response = await fetch(`${API_BASE_URL}/messages/direct/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startConversation: true }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.status} ${response.statusText}`);
      }

      const messageData = await response.json();
      console.log('Created new conversation:', messageData);

      const conversationId = messageData.conversationId || messageData._id;
      if (!conversationId) {
        console.error('No conversation ID in response:', messageData);
        toast.error('Failed to create conversation');
        return null;
      }

      const otherUser = users.find(u => u._id === userId);
      if (!otherUser) {
        console.error('Could not find user details for:', userId);
        toast.error('Could not find user details');
        return null;
      }

      const sortedIds = [user._id, otherUser._id].sort();
      const newConversation = {
        _id: conversationId,
        userId: userId,
        username: otherUser.username,
        profilePicture: otherUser.profilePicture,
        status: otherUser.status || 'offline',
        unreadCount: 0,
        lastMessage: messageData._id ? messageData : null,
        receiverId: userId,
        emptyConversation: !messageData._id,
        standardConversationId: `dm_${sortedIds[0]}_${sortedIds[1]}` // Added for room joining
      };

      setDirectConversations(prev => {
        const filtered = prev.filter(c =>
          c._id !== newConversation._id &&
          c.userId !== userId &&
          (c.otherUser?._id !== userId)
        );
        const updated = [newConversation, ...filtered];
        localStorage.setItem('openChats', JSON.stringify(updated));
        console.log('Updated direct conversations:', updated);
        return updated;
      });

      toast.success(`Started conversation with ${otherUser.username}`);
      return newConversation;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error(`Failed to start conversation: ${error.message}`);
      return null;
    }
  }, [user?.token, user?._id, directConversations, users]);

  // Function to remove a conversation from recent conversations list
  const removeConversation = useCallback(async (conversationId) => {
    if (!conversationId || !user?.token) return;

    console.log(`Removing conversation with ID: ${conversationId}`);

    try {
      const url = `${API_BASE_URL}/users/open-chats/${conversationId}`;
      console.log('Making API call to:', url);

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
        throw new Error(`Failed to delete conversation: ${response.status} ${response.statusText}`);
      }

      setDirectConversations(prev => {
        const updated = prev.filter(c => c._id !== conversationId);
        localStorage.setItem('openChats', JSON.stringify(updated));
        return updated;
      });

      console.log('Successfully deleted conversation');
    } catch (error) {
      console.error('Error removing conversation:', error);
      toast.error('Failed to remove conversation');
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
        throw new Error(`Failed to create channel: ${response.status} ${response.statusText}`);
      }

      const newChannel = await response.json();

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

  // Fetch data when user is logged in
  useEffect(() => {
    const loadData = async () => {
      if (user?.token) {
        await Promise.all([
          fetchChannels(),
          fetchDirectConversations(),
          fetchUsers()
        ]);

        try {
          const savedConversations = localStorage.getItem('openChats');
          if (savedConversations) {
            const parsed = JSON.parse(savedConversations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('Loaded saved conversations:', parsed);
              setDirectConversations(prev => {
                const existingIds = new Set(parsed.map(c => c._id));
                const newOnes = prev.filter(c => !existingIds.has(c._id));
                // Add standardConversationId to saved conversations if missing
                const updatedParsed = parsed.map(conv => {
                  if (conv.standardConversationId) return conv;
                  const otherUserId = conv.userId || conv.otherUser?._id;
                  const sortedIds = [user._id, otherUserId].sort();
                  return {
                    ...conv,
                    standardConversationId: `dm_${sortedIds[0]}_${sortedIds[1]}`
                  };
                });
                return [...updatedParsed, ...newOnes];
              });
            }
          }
        } catch (error) {
          console.error('Error loading saved conversations:', error);
        }
      }
    };

    loadData();
  }, [user?.token, fetchChannels, fetchDirectConversations, fetchUsers, user?._id]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewConversation = (conversation) => {
      if (conversation.type === 'channel') {
        setChannels(prev => {
          if (prev.some(c => c.id === conversation._id)) return prev;
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
        const otherUserId = conversation.participants?.find(p => p._id !== user._id)?._id;
        const sortedIds = [user._id, otherUserId].sort();
        const formattedConversation = {
          _id: conversation._id,
          userId: otherUserId,
          username: conversation.otherUser?.username || 'Unknown',
          profilePicture: conversation.otherUser?.profilePicture || null,
          status: conversation.otherUser?.status || 'offline',
          standardConversationId: `dm_${sortedIds[0]}_${sortedIds[1]}`
        };
        setDirectConversations(prev => {
          if (prev.some(c => c._id === conversation._id)) return prev;
          return [...prev, formattedConversation];
        });
      }
    };

    const handleOnlineUsers = (onlineUserList) => {
      console.log('Online users received:', onlineUserList);
      if (!Array.isArray(onlineUserList)) return;

      setUsers(prev => {
        const updatedUsers = prev.map(u => {
          const onlineUser = onlineUserList.find(ou => ou.userId === u._id);
          return onlineUser ? { ...u, status: onlineUser.status } : u;
        });

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

      setDirectConversations(prev => prev.map(conv => {
        const onlineUser = onlineUserList.find(ou => ou.userId === conv.userId);
        return onlineUser ? { ...conv, status: onlineUser.status } : conv;
      }));
    };

    const handleUserConnected = (data) => {
      console.log('User connected:', data);
      if (!data || !data.userId) return;

      setUsers(prev => {
        const userExists = prev.some(u => u._id === data.userId);
        if (userExists) {
          return prev.map(u =>
            u._id === data.userId ? { ...u, status: 'online' } : u
          );
        } else if (data.username && data.userId !== user?._id) {
          return [...prev, {
            _id: data.userId,
            username: data.username,
            status: 'online',
            profilePicture: data.profilePicture || null
          }];
        }
        return prev;
      });

      setDirectConversations(prev => prev.map(conv =>
        conv.userId === data.userId ? { ...conv, status: 'online' } : conv
      ));
    };

    const handleUserDisconnected = (data) => {
      console.log('User disconnected:', data);
      if (!data || !data.userId) return;

      setUsers(prev => prev.map(u =>
        u._id === data.userId ? { ...u, status: 'offline' } : u
      ));

      setDirectConversations(prev => prev.map(conv =>
        conv.userId === data.userId ? { ...conv, status: 'offline' } : conv
      ));
    };

    socket.on('newConversation', handleNewConversation);
    socket.on('userConnected', handleUserConnected);
    socket.on('userDisconnected', handleUserDisconnected);
    socket.on('onlineUsers', handleOnlineUsers);

    return () => {
      socket.off('newConversation', handleNewConversation);
      socket.off('userConnected', handleUserConnected);
      socket.off('userDisconnected', handleUserDisconnected);
      socket.off('onlineUsers', handleOnlineUsers);
    };
  }, [socket, connected, user?._id]);

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
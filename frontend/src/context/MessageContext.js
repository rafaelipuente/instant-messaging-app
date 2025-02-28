import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

// Create the context
const MessageContext = createContext(null);

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const { connected, emitEvent, onEvent } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationType, setConversationType] = useState('channel'); // 'channel' or 'direct'
  const [unreadMessages, setUnreadMessages] = useState({});
  const [typing, setTyping] = useState(null);

  // Function to load messages for a conversation
  const loadMessages = useCallback((conversation, type) => {
    if (!connected || !conversation) {
      console.error('Cannot load messages: not connected or no conversation selected');
      return false;
    }
    
    setLoading(true);
    
    try {
      console.log(`Loading ${type} messages for:`, conversation);
      
      // Clear current messages
      setMessages([]);
      
      // Set active conversation and type
      setActiveConversation(conversation);
      setConversationType(type);
      
      // Standardized approach for both channel and direct messages
      let conversationId;
      
      if (type === 'channel') {
        // Handle channel messages - use name or id
        conversationId = conversation.id || conversation._id || conversation.name;
        
        if (!conversationId) {
          toast.error('Invalid channel selected');
          setLoading(false);
          return false;
        }
        
        console.log(`Emitting loadInitialMessages for channel: ${conversationId}`);
        
        // Ensure we're sending the channel name as a string
        // This is crucial for proper message loading on the server
        const channelName = typeof conversationId === 'string' ? conversationId : String(conversationId);
        
        emitEvent('loadInitialMessages', {
          type: 'channel',
          channel: channelName,
          id: channelName
        });
      } else if (type === 'direct') {
        // Handle direct messages - use id
        conversationId = conversation._id;
        
        if (!conversationId) {
          toast.error('Invalid conversation selected');
          setLoading(false);
          return false;
        }
        
        console.log(`Emitting loadInitialMessages for direct conversation with: ${conversationId}`);
        
        emitEvent('loadInitialMessages', {
          type: 'direct',
          channel: conversationId,
          id: conversationId
        });
        
        // We'll handle marking as read separately to avoid circular dependencies
      }
      
      return true;
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
      setLoading(false);
      return false;
    }
  }, [connected, emitEvent]);

  // Function to send a message
  const sendMessage = useCallback((content) => {
    if (!content || !content.trim()) {
      return false;
    }
    
    if (!connected || !activeConversation) {
      console.error('Cannot send message:', { 
        connected: connected ? 'yes' : 'no', 
        activeConversation: activeConversation ? 'yes' : 'no'
      });
      return false;
    }
    
    try {
      const timestamp = new Date();
      const tempId = `temp-${timestamp.getTime()}`;
      
      // Create a temporary message to show immediately
      const tempMessage = {
        _id: tempId,
        content: content.trim(),
        sender: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        timestamp,
        pending: true
      };
      
      console.log(`Sending ${conversationType} message:`, {
        content: content.trim(),
        to: conversationType === 'direct' ? activeConversation.username : activeConversation.name
      });
      
      // Handle based on conversation type
      if (conversationType === 'direct') {
        // Add receiver info
        tempMessage.receiver = {
          _id: activeConversation._id,
          username: activeConversation.username
        };
        
        // Emit direct message event
        emitEvent('directMessage', {
          content: content.trim(),
          receiverId: activeConversation._id,
          tempId
        });
      } else {
        // For channel messages
        const channelName = activeConversation.name || 
                          (typeof activeConversation === 'string' ? activeConversation : 
                           activeConversation.id || activeConversation._id);
        
        if (!channelName) {
          console.error('Cannot send channel message: Missing channel name', activeConversation);
          toast.error('Cannot send message to this channel');
          return false;
        }
        
        // Add channel to temp message
        tempMessage.channel = channelName;
        
        // Emit channel message event
        emitEvent('channelMessage', {
          content: content.trim(),
          channel: channelName,
          tempId
        });
      }
      
      // Add temporary message to state
      setMessages(prev => [...prev, tempMessage]);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return false;
    }
  }, [activeConversation, conversationType, user, emitEvent, connected]);

  // Function to delete a message
  const deleteMessage = useCallback((messageId) => {
    if (!connected) return false;
    
    try {
      // Optimistically update UI
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, isDeleted: true, content: 'This message was deleted', deleting: true } 
            : msg
        )
      );
      
      // Emit delete event
      emitEvent('deleteMessage', { messageId });
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
      return false;
    }
  }, [connected, emitEvent]);

  // Handler for receiving messages from either channels or direct messages
  const handleMessageReceived = useCallback((data) => {
    console.log('Received message:', data);
    if (!data || !data.message) {
      console.error('Received invalid message format:', data);
      return;
    }
    
    const newMessage = data.message;
    const messageType = data.type; // 'channel' or 'direct'
    
    // Don't add duplicate messages
    setMessages(prev => {
      // Check if message with this ID already exists
      if (prev.some(msg => msg._id === newMessage._id)) {
        return prev;
      }
      
      // Replace any temporary message with the server response
      if (newMessage.tempId && prev.some(msg => msg._id === newMessage.tempId)) {
        return prev.map(msg => 
          msg._id === newMessage.tempId ? newMessage : msg
        );
      }
      
      // Ensure messages are in chronological order
      const updatedMessages = [...prev, newMessage];
      return updatedMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt);
        const timeB = new Date(b.timestamp || b.createdAt);
        return timeA - timeB;
      });
    });
    
    // Handle unread count if this is for a different conversation
    if (messageType === 'channel' && 
        activeConversation && 
        newMessage.channel !== (activeConversation.id || activeConversation._id || activeConversation.name)) {
      setUnreadMessages(prev => ({
        ...prev,
        [newMessage.channel]: (prev[newMessage.channel] || 0) + 1
      }));
    }
    
    if (messageType === 'direct' && 
        activeConversation && 
        newMessage.sender._id !== user._id && 
        (newMessage.sender._id !== activeConversation._id && 
         newMessage.receiver._id !== activeConversation._id)) {
      setUnreadMessages(prev => ({
        ...prev,
        [newMessage.sender._id]: (prev[newMessage.sender._id] || 0) + 1
      }));
    }
  }, [activeConversation, user]);

  // Handler for receiving previous messages
  const handlePreviousMessages = useCallback((receivedMessages) => {
    setMessages(receivedMessages);
    setLoading(false);
  }, []);

  // Handler for initial messages
  const handleInitialMessages = useCallback((data) => {
    console.log('Received initial messages:', data);
    if (data && data.messages && Array.isArray(data.messages)) {
      // Ensure messages are sorted by timestamp
      const sortedMessages = [...data.messages].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt);
        const timeB = new Date(b.timestamp || b.createdAt);
        return timeA - timeB;
      });
      
      setMessages(sortedMessages);
      setLoading(false);
      
      // Update active conversation if needed
      if (data.type && data.type === conversationType) {
        // This is a confirmation that we're in the right conversation
        console.log('Received messages for the active conversation type:', data.type);
      }
    } else {
      console.error('Received malformed initial messages:', data);
      setLoading(false);
    }
  }, [conversationType]);

  // Handler for message deletion
  const handleMessageDeleted = useCallback(({ messageId }) => {
    setMessages(prev => 
      prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, isDeleted: true, content: 'This message was deleted', deleting: false } 
          : msg
      )
    );
  }, []);

  // Handler for typing indicators
  const handleTypingStatus = useCallback(({ channel, username, isTyping }) => {
    // Only show typing indicator if it's in the current conversation
    if ((conversationType === 'channel' && 
         activeConversation && 
         channel === (activeConversation.id || activeConversation._id)) ||
        (conversationType === 'direct' && 
         activeConversation && 
         (channel === `${user._id}-${activeConversation._id}` || 
          channel === `${activeConversation._id}-${user._id}`))) {
      setTyping(isTyping ? username : null);
    }
  }, [activeConversation, conversationType, user]);

  // Set up event listeners
  useEffect(() => {
    if (!connected) return;
    
    // Register event listeners
    const cleanupFunctions = [
      onEvent('previousMessages', handlePreviousMessages),
      onEvent('initialMessages', handleInitialMessages),
      onEvent('messageReceived', handleMessageReceived),    // Unified message event
      onEvent('messageDeleted', handleMessageDeleted),
      onEvent('userTyping', ({ channel, username }) => handleTypingStatus({ channel, username, isTyping: true })),
      onEvent('userStopTyping', ({ channel }) => handleTypingStatus({ channel, isTyping: false }))
    ];
    
    // Clean up all event listeners
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [
    connected, 
    onEvent, 
    handlePreviousMessages,
    handleInitialMessages,
    handleMessageReceived,
    handleMessageDeleted,
    handleTypingStatus
  ]);

  // Function to mark conversation as read
  const markAsRead = useCallback((conversationId) => {
    setUnreadMessages(prev => ({
      ...prev,
      [conversationId]: 0
    }));
  }, []);

  return (
    <MessageContext.Provider value={{
      messages,
      loading,
      activeConversation,
      conversationType,
      typing,
      unreadMessages,
      loadMessages,
      sendMessage,
      deleteMessage,
      markAsRead,
      setActiveConversation,
      setConversationType
    }}>
      {children}
    </MessageContext.Provider>
  );
};

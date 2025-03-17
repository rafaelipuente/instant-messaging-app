import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [channelMessages, setChannelMessages] = useState({});
  const [directMessages, setDirectMessages] = useState({});
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationType, setConversationType] = useState('channel');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});

  const messages = conversationType === 'channel'
    ? (channelMessages[activeConversation?.id || activeConversation?.name] || [])
    : (directMessages[activeConversation?._id] || []);

  const setMessages = (msgs) => {
    if (conversationType === 'channel' && activeConversation) {
      setChannelMessages(prev => ({
        ...prev,
        [activeConversation.id || activeConversation.name]: msgs
      }));
    } else if (conversationType === 'direct' && activeConversation) {
      setDirectMessages(prev => ({
        ...prev,
        [activeConversation._id]: msgs
      }));
    }
  };

  // Track the last loaded time for each conversation to prevent rapid reloading
  const lastLoadTimeRef = useRef({});
  // Track pending load requests
  const pendingLoadsRef = useRef({});

  const loadMessages = useCallback(async (conversation, type) => {
    if (!conversation || !user || !socket || !connected) {
      console.log('[LOAD MESSAGES] Skipping load due to missing dependencies:', { conversation, user, socket, connected });
      return;
    }

    const id = type === 'channel'
      ? (typeof conversation === 'string' ? conversation : conversation.id || conversation.name)
      : (conversation._id || conversation.userId);
    
    const loadKey = `${type}:${id}`;
    
    // Don't reload if we've loaded in the last 3 seconds (prevents rapid switching issues)
    const now = Date.now();
    const lastLoadTime = lastLoadTimeRef.current[loadKey] || 0;
    if (now - lastLoadTime < 3000) {
      console.log(`[LOAD MESSAGES] Skipping reload for ${loadKey}, last loaded ${now - lastLoadTime}ms ago`);
      return;
    }
    
    // If we already have a pending load for this conversation, don't start another
    if (pendingLoadsRef.current[loadKey]) {
      console.log(`[LOAD MESSAGES] Already loading messages for ${loadKey}, skipping duplicate request`);
      return;
    }

    // Mark this conversation as loading
    pendingLoadsRef.current[loadKey] = true;
    setLoading(true);

    try {
      console.log(`[LOAD MESSAGES] Loading ${type} messages for ${id}`);
      socket.emit('loadInitialMessages', { id, type, channel: type === 'channel' ? id : undefined });
      
      // Create a promise that will resolve when we get the messages or timeout
      const messagesData = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          delete pendingLoadsRef.current[loadKey];
          reject(new Error('Request timed out'));
        }, 8000);
        
        // Use a dedicated handler function we can reference for removal
        function messageHandler(data) {
          clearTimeout(timeoutId);
          if (data.error) {
            if (data.throttled) {
              // Don't show errors for throttling, just handle quietly
              console.warn(`[LOAD MESSAGES] Request throttled for ${loadKey}`);
              resolve({ messages: [] }); // Resolve with empty messages to avoid error toast
            } else {
              reject(new Error(data.error));
            }
          } else {
            resolve(data);
          }
        }
        
        // Use once to ensure cleanup
        socket.once('loadInitialMessages', messageHandler);
        socket.once('error', (error) => {
          clearTimeout(timeoutId);
          socket.off('loadInitialMessages', messageHandler);
          reject(new Error(error.message));
        });
      });

      // Update the last load time
      lastLoadTimeRef.current[loadKey] = Date.now();
      
      // Process messages only if they exist
      const loadedMessages = messagesData.messages || [];
      if (loadedMessages.length > 0) {
        if (type === 'channel') {
          setChannelMessages(prev => ({
            ...prev,
            [id]: loadedMessages
          }));
        } else {
          setDirectMessages(prev => ({
            ...prev,
            [id]: loadedMessages
          }));
        }
        console.log(`[LOAD MESSAGES] Loaded ${loadedMessages.length} messages for ${id}`);
      } else if (!messagesData.error) {
        console.log(`[LOAD MESSAGES] No messages found for ${loadKey}`);
      }
    } catch (error) {
      console.error('[LOAD MESSAGES] Error:', error);
      // Only show error toast for non-throttling errors
      if (!error.message.includes('Too many requests')) {
        toast.error(`Failed to load messages: ${error.message}`);
      }
    } finally {
      // Clear the pending flag
      delete pendingLoadsRef.current[loadKey];
      setLoading(false);
    }
  }, [socket, connected, user]);

  const sendMessage = useCallback((content) => {
    console.log('[SEND MESSAGE] Attempting to send message with dependencies:', {
      content,
      activeConversation: activeConversation ? {
        _id: activeConversation._id,
        userId: activeConversation.userId,
        standardConversationId: activeConversation.standardConversationId
      } : null,
      conversationType,
      connected,
      socket: socket ? socket.id : null,
      user: user ? user._id : null
    });

    if (!content.trim()) {
      console.error('[SEND MESSAGE] Cannot send: Message content is empty');
      return false;
    }

    if (!activeConversation) {
      console.error('[SEND MESSAGE] Cannot send: No active conversation');
      return false;
    }

    if (!connected || !socket) {
      console.error('[SEND MESSAGE] Cannot send: Socket not connected', { connected, socket });
      return false;
    }

    if (!user) {
      console.error('[SEND MESSAGE] Cannot send: User not authenticated');
      return false;
    }

    const tempId = uuidv4();
    const messageData = {
      content,
      tempId,
      sender: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        status: user.status
      },
      timestamp: new Date().toISOString(),
      pending: true
    };

    if (conversationType === 'channel') {
      const channelId = activeConversation.id || activeConversation.name;
      messageData.channel = channelId;
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: [...(prev[channelId] || []), messageData]
      }));
      socket.emit('channelMessage', { content, channel: channelId, tempId });
      console.log('[SEND MESSAGE] Emitted channelMessage:', { content, channel: channelId, tempId });
    } else {
      const receiverId = activeConversation.userId || activeConversation._id;
      messageData.receiver = { _id: receiverId };
      messageData.conversationId = activeConversation._id;
      setDirectMessages(prev => ({
        ...prev,
        [activeConversation._id]: [...(prev[activeConversation._id] || []), messageData]
      }));
      console.log(`[SEND MESSAGE] Emitting directMessage to room ${activeConversation.standardConversationId}`, {
        content,
        receiverId,
        conversationId: activeConversation._id,
        tempId
      });
      socket.emit('directMessage', { 
        content, 
        receiverId, 
        conversationId: activeConversation._id, 
        tempId,
        standardRoomId: activeConversation.standardConversationId
      });
    }

    return true;
  }, [socket, connected, user, activeConversation, conversationType]);

  const deleteMessage = useCallback((messageId) => {
    if (!messageId || !socket || !activeConversation) return;

    if (conversationType === 'channel') {
      const channelId = activeConversation.id || activeConversation.name;
      setChannelMessages(prev => ({
        ...prev,
        [channelId]: (prev[channelId] || []).map(msg =>
          msg._id === messageId ? { ...msg, deleting: true } : msg
        )
      }));
    } else {
      setDirectMessages(prev => ({
        ...prev,
        [activeConversation._id]: (prev[activeConversation._id] || []).map(msg =>
          msg._id === messageId ? { ...msg, deleting: true } : msg
        )
      }));
    }

    socket.emit('deleteMessage', { messageId });
  }, [socket, activeConversation, conversationType]);

  const markAsRead = useCallback((conversationId) => {
    if (!conversationId || !socket) return;

    setUnreadMessages(prev => ({
      ...prev,
      [conversationId]: 0
    }));

    socket.emit('markAsRead', { conversationId });
  }, [socket]);

  // Pre-define event handlers outside of the useEffect for persistence
  // This ensures the same handler references are maintained across re-renders
  const eventHandlers = useRef({
    initialize: false,
    handlers: null
  });

  // This separate effect ensures the handlers are defined once and maintained across reconnections
  useEffect(() => {
    if (eventHandlers.current.initialize) return;
    
    // Only initialize these handlers once
    const handleDirectMessage = (message) => {
      console.log('[DIRECT MESSAGE HANDLER] Processing received message:', message);
      
      if (!message || !message.sender || !message.content) {
        console.error('[DIRECT MESSAGE HANDLER] Invalid message received:', message);
        return;
      }
      
      try {
        // First, determine the correct conversation ID to use for storing the message
        const senderId = message.sender._id;
        const receiverId = message.receiver?._id;
        const isFromCurrentUser = message.sender._id === user?._id || message.fromSelf;
        
        // Determine which conversation this message belongs to
        let conversationId = message.conversationId;
        
        if (!conversationId && senderId && receiverId) {
          // If no conversation ID was provided, try to construct one
          // For user-to-user direct messages, we can use a deterministic ID
          conversationId = isFromCurrentUser ? receiverId : senderId;
        }
        
        // If we still don't have a valid conversation ID, we can't process the message
        if (!conversationId) {
          console.error('[DIRECT MESSAGE HANDLER] Cannot determine conversation ID for message:', message);
          return;
        }
        
        console.log(`[DIRECT MESSAGE HANDLER] Using conversation ID: ${conversationId}`);
        
        // Format the message for the UI
        const formattedMessage = {
          _id: message._id,
          id: message._id, // For backward compatibility
          content: message.content,
          sender: message.sender,
          receiver: message.receiver,
          timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
          fromSelf: isFromCurrentUser,
          conversationId,
          pending: false
        };
        
        // Check for duplicates before adding to the state
        // This is important because messages might be received multiple times
        setDirectMessages(prev => {
          const existingMessages = prev[conversationId] || [];
          
          // Check if this message already exists in the conversation
          const isDuplicate = existingMessages.some(m => 
            // Consider messages duplicate if they have the same ID
            (m._id && m._id === message._id) ||
            // Or if they have the same tempId (for pending messages)
            (m.tempId && message.tempId && m.tempId === message.tempId) ||
            // Or if they have the exact same content, sender, and timestamp (within 100ms)
            (m.content === message.content &&
             m.sender._id === message.sender._id &&
             Math.abs(new Date(m.timestamp) - new Date(message.timestamp || new Date())) < 100)
          );
          
          if (isDuplicate) {
            console.log('[DIRECT MESSAGE HANDLER] Ignoring duplicate message:', message._id);
            
            // For messages with tempId, we should update them to remove the 'pending' status
            if (message.tempId) {
              const updatedMessages = existingMessages.map(m => 
                m.tempId === message.tempId ? { ...m, pending: false, _id: message._id } : m
              );
              return {
                ...prev,
                [conversationId]: updatedMessages
              };
            }
            
            return prev;
          }
          
          // Not a duplicate, add it to the conversation
          const updatedMessages = [...existingMessages, formattedMessage];
          
          // Sort messages by timestamp
          const sortedMessages = updatedMessages.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          console.log(`[DIRECT MESSAGE HANDLER] Added message to conversation ${conversationId}, total: ${sortedMessages.length}`);
          
          return {
            ...prev,
            [conversationId]: sortedMessages
          };
        });
        
        // If this is a message from someone else, increment the unread count
        if (!isFromCurrentUser && (!activeConversation || activeConversation._id !== conversationId)) {
          setUnreadMessages(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || 0) + 1
          }));
        }
      } catch (err) {
        console.error('[DIRECT MESSAGE HANDLER] Error processing message:', err);
      }
    };

    const handleChannelMessage = (message) => {
      console.log('[CHANNEL MESSAGE RECEIVED] Listener triggered for:', { message });
      const channelId = message.channel;
      if (!channelId) {
        console.warn('[CHANNEL MESSAGE RECEIVED] Missing channelId:', message);
        return;
      }
      
      // Enhanced message deduplication based on multiple fields
      setChannelMessages(prev => {
        const existing = prev[channelId] || [];
        // Check for duplicates using multiple criteria
        const exists = existing.some(m => 
          // Match by _id if available
          (m._id && message._id && m._id === message._id) ||
          // Match by tempId if available
          (m.tempId && message.tempId && m.tempId === message.tempId) ||
          // Match by content and timestamp (within 1 second) as fallback
          (m.content === message.content && 
           m.sender && message.sender && 
           m.sender.username === message.sender.username &&
           m.timestamp && message.timestamp && 
           Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 1000)
        );
        
        if (exists) {
          console.log('[CHANNEL MESSAGE RECEIVED] Duplicate message detected:', message._id || message.tempId);
          // Update the existing message (e.g., replace tempId with real _id)
          return {
            ...prev,
            [channelId]: existing.map(m => {
              if ((m._id && message._id && m._id === message._id) || 
                  (m.tempId && message.tempId && m.tempId === message.tempId) ||
                  (m.content === message.content && 
                   m.sender && message.sender && 
                   m.sender.username === message.sender.username &&
                   m.timestamp && message.timestamp && 
                   Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 1000)) {
                // Merge the messages - keep local properties that are useful
                return { 
                  ...message, 
                  pending: false,
                  _id: message._id || m._id, // Ensure _id is preserved
                  timestamp: message.timestamp || m.timestamp,
                  // If this was a local temp message, preserve the metadata we care about
                  alreadyShown: true
                };
              }
              return m;
            })
          };
        } else {
          console.log('[CHANNEL MESSAGE RECEIVED] New message added:', message._id || message.tempId);
          // Add the new message
          return {
            ...prev,
            [channelId]: [...existing, message]
          };
        }
      });
      
      if (conversationType !== 'channel' || (activeConversation?.id || activeConversation?.name) !== channelId) {
        setUnreadMessages(prev => ({
          ...prev,
          [channelId]: (prev[channelId] || 0) + 1
        }));
      }
    };

    const handleMessageReceived = (data) => {
      console.log('[MESSAGE RECEIVED] Generic listener triggered for:', { data });
      
      if (data.type === 'direct' && data.message) {
        handleDirectMessage(data.message);
      } else if (data.type === 'channel' && data.message) {
        handleChannelMessage(data.message);
      } else {
        console.warn('[MESSAGE RECEIVED] Received message with unknown type:', data);
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      if (conversationType === 'channel' && activeConversation) {
        const channelId = activeConversation.id || activeConversation.name;
        setChannelMessages(prev => ({
          ...prev,
          [channelId]: (prev[channelId] || []).map(msg =>
            msg._id === messageId ? { ...msg, isDeleted: true, content: 'This message has been deleted', deleting: false } : msg
          )
        }));
      } else if (conversationType === 'direct' && activeConversation) {
        setDirectMessages(prev => ({
          ...prev,
          [activeConversation._id]: (prev[activeConversation._id] || []).map(msg =>
            msg._id === messageId ? { ...msg, isDeleted: true, content: 'This message has been deleted', deleting: false } : msg
          )
        }));
      }
    };

    const handleTyping = ({ channel, username }) => {
      const currentChannel = conversationType === 'channel'
        ? (activeConversation?.id || activeConversation?.name)
        : activeConversation?.standardConversationId;
      if (channel === currentChannel) {
        setTyping(username);
      }
    };

    const handleStopTyping = ({ channel }) => {
      const currentChannel = conversationType === 'channel'
        ? (activeConversation?.id || activeConversation?.name)
        : activeConversation?.standardConversationId;
      if (channel === currentChannel) {
        setTyping(null);
      }
    };

    // Store handlers in the ref
    eventHandlers.current.handlers = {
      directMessage: handleDirectMessage,
      channelMessage: handleChannelMessage,
      messageReceived: handleMessageReceived,
      messageDeleted: handleMessageDeleted,
      typing: handleTyping,
      stopTyping: handleStopTyping,
      // Add handler for directMessageConfirmation event
      directMessageConfirmation: (message) => {
        console.log('[DIRECT MESSAGE CONFIRMATION] Received confirmation:', message);
        // We don't need to process this as the message was already added by the sender
        // This is just a confirmation from the server that the message was sent
      },
      // Special handlers for specific sender/receiver events
      'directMessageFrom:*': (message) => {
        console.log('[DIRECT MESSAGE FROM] Received message from specific sender:', message);
        if (message && message.sender && message.conversationId) {
          handleDirectMessage(message);
        }
      },
      // Add globalDirectMessage handler for catching broadcast fallbacks
      globalDirectMessage: (data) => {
        if (data && data.message && user && 
            data.intendedRecipients && 
            data.intendedRecipients.includes(user._id)) {
          console.log('[GLOBAL DIRECT MESSAGE] Received message intended for this user');
          handleDirectMessage(data.message);
        }
      }
    };

    eventHandlers.current.initialize = true;
  }, [conversationType, activeConversation, user]);

  // This effect handles the actual socket event binding and unbinding
  useEffect(() => {
    if (!socket) {
      console.log('[MESSAGE CONTEXT] Socket not available yet, skipping listener setup');
      return;
    }

    if (!connected) {
      console.log('[MESSAGE CONTEXT] Socket not connected, waiting for connection');
      return;
    }

    if (!eventHandlers.current.initialize || !eventHandlers.current.handlers) {
      console.log('[MESSAGE CONTEXT] Event handlers not initialized yet');
      return;
    }

    console.log('[MESSAGE CONTEXT] Setting up listeners with socket:', socket.id);
    
    // Add debug listener for all events
    socket.onAny((event, ...args) => {
      console.log(`[DEBUG] Socket event received: ${event}`, 
        event.includes('directMessage') ? JSON.stringify(args, null, 2) : 'args omitted');
    });

    // Register all event handlers
    const handlers = eventHandlers.current.handlers;
    Object.entries(handlers).forEach(([event, handler]) => {
      // Special handling for wildcard events
      if (event.includes('*')) {
        const baseEvent = event.split(':')[0];
        console.log(`[MESSAGE CONTEXT] Registering wildcard listener for ${baseEvent}`);
        
        // For wildcard events like 'directMessageFrom:*', we need to listen to all matching events
        // This is a pattern like 'directMessageFrom:userId'
        socket.onAny((eventName, ...args) => {
          if (eventName.startsWith(baseEvent)) {
            console.log(`[MESSAGE CONTEXT] Wildcard event triggered: ${eventName}`);
            handler(...args);
          }
        });
      } else {
        console.log(`[MESSAGE CONTEXT] Registering listener for ${event}`);
        socket.on(event, handler);
      }
    });

    // Also listen for connect and reconnect to ensure handlers are registered
    const handleReconnect = () => {
      console.log('[MESSAGE CONTEXT] Socket reconnected, re-registering handlers');
      Object.entries(handlers).forEach(([event, handler]) => {
        // Remove first to prevent duplicates
        socket.off(event, handler);
        // Re-add the handler
        socket.on(event, handler);
      });
      
      // After reconnection, request any missed messages
      if (activeConversation) {
        console.log('[MESSAGE CONTEXT] Requesting messages after reconnection');
        loadMessages(activeConversation, conversationType);
      }
    };

    socket.on('connect', handleReconnect);
    socket.on('reconnect', handleReconnect);

    return () => {
      // Clean up all event listeners
      Object.entries(handlers).forEach(([event, handler]) => {
        console.log(`[MESSAGE CONTEXT] Removing listener for ${event}`);
        socket.off(event, handler);
      });
      
      socket.off('connect', handleReconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, connected, activeConversation, conversationType, user, loadMessages]);

  const value = {
    messages,
    setMessages,
    channelMessages,
    directMessages,
    activeConversation,
    setActiveConversation,
    conversationType,
    setConversationType,
    loading,
    typing,
    unreadMessages,
    loadMessages,
    sendMessage,
    deleteMessage,
    markAsRead
  };

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessages = () => useContext(MessageContext);
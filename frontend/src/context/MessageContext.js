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
    if (!connected) {
      
      return false;
    }

    if (!conversation) {
      console.error('Cannot load messages: No conversation selected');
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
        // For channels, we need the channel name (lowercase, with hyphens) for backend lookup
        // First try to get the ID (which should be the channel name in database format)
        if (typeof conversation === 'string') {
          // If conversation is just a string, use it directly
          conversationId = conversation.toLowerCase();
        } else {
          // If it's an object, prefer id over name (id should be the database name)
          conversationId = conversation.id || conversation.name || conversation._id;
        }
        
        // Log for debugging
        console.log(`Using channel ID: ${conversationId} for messages`);
        
        if (!conversationId) {
          console.error('Invalid channel selected:', conversation);
          toast.error('Invalid channel selected');
          setLoading(false);
          return false;
        }
        
        // Ensure we're sending the channel name as a string
        // This is crucial for proper message loading on the server
        const channelName = typeof conversationId === 'string' ? conversationId : String(conversationId);
        
        console.log(`Emitting loadInitialMessages for channel [${channelName}]`);
        
        emitEvent('loadInitialMessages', {
          type: 'channel',
          channel: channelName,
          id: channelName
        });
      } else if (type === 'direct') {
        // Handle direct messages - use id
        conversationId = conversation._id;
        
        if (!conversationId) {
          console.error('Invalid direct conversation selected:', conversation);
          toast.error('Invalid conversation selected');
          setLoading(false);
          return false;
        }
        
        console.log(`Emitting loadInitialMessages for direct conversation [${conversationId}]`);
        
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
      // Create a unique tempId without the 'temp-' prefix (will be added in handleMessageReceived)
      const tempId = `${timestamp.getTime()}-${Math.floor(Math.random() * 10000)}`;
      
      // Create a temporary message to show immediately
      const tempMessage = {
        _id: `temp-${tempId}`,
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
        // Add receiver info - use userId if available (for proper message routing), otherwise use _id
        const receiverId = activeConversation.userId || activeConversation._id;
        
        tempMessage.receiver = {
          _id: receiverId,
          username: activeConversation.username
        };
        
        // Store the actual conversation ID for lookup when receiving the server response
        tempMessage.conversationId = activeConversation._id;
        
        console.log(`Sending direct message to ${activeConversation.username} with ID ${receiverId}, conversationId: ${activeConversation._id}`);
        
        // Emit direct message event
        emitEvent('directMessage', {
          content: content.trim(),
          receiverId: receiverId,
          tempId,
          conversationId: activeConversation._id // Pass the conversation ID to help with matching
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
    try {
      console.log('Received message:', data);
      if (!data) {
        console.error('Received null or undefined message data');
        return;
      }
      
      // Check for legacy or new message format
      let newMessage;
      let messageType;
      
      // Handle legacy format where message is nested
      if (data.message) {
        newMessage = data.message;
        messageType = data.type; // 'channel' or 'direct'
      } 
      // Handle newer format where message data is at the top level
      else if (data._id) {
        newMessage = data;
        // Try to determine message type
        if (data.type) {
          messageType = data.type;
        } else if (data.channel) {
          messageType = 'channel';
        } else if (data.sender && data.receiver) {
          messageType = 'direct';
        } else {
          console.error('Cannot determine message type from:', data);
          return;
        }
      } else {
        console.error('Received invalid message format:', data);
        return;
      }
      
      if (!newMessage._id) {
        console.error('Message missing _id:', newMessage);
        return;
      }
      
      console.log(`Processing ${messageType} message:`, {
        id: newMessage._id,
        from: newMessage.sender?.username || newMessage.sender?._id || 'unknown',
        to: messageType === 'direct' ?
           (newMessage.receiver?.username || newMessage.receiver?._id || 'unknown') :
           (newMessage.channel || 'unknown channel'),
        tempId: newMessage.tempId || 'none'
      });
      
      // For direct messages, ensure the conversation ID is properly set and user IDs are consistent
      if (messageType === 'direct') {
        // Make sure sender and receiver have _id fields set
        if (newMessage.sender) {
          newMessage.sender._id = newMessage.sender._id || newMessage.sender.userId || newMessage.senderId;
        }
        
        if (newMessage.receiver) {
          newMessage.receiver._id = newMessage.receiver._id || newMessage.receiver.userId || newMessage.receiverId;
        }
        
        // Store all possible IDs for this message for flexible matching
        newMessage._possibleIds = [];
        
        // 1. Use actual conversationId if available - highest priority
        if (newMessage.conversationId) {
          newMessage._possibleIds.push(newMessage.conversationId);
          console.log(`Using provided conversation ID: ${newMessage.conversationId}`);
        }
        
        // 2. Construct possible IDs from sender/receiver
        const senderId = newMessage.sender?._id;
        const receiverId = newMessage.receiver?._id;
          
        if (senderId && receiverId) {
          // Standard format with sorted IDs
          const sortedIds = [senderId.toString(), receiverId.toString()].sort();
          const standardRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
          newMessage._possibleIds.push(standardRoomId);
          
          // Direct combinations
          newMessage._possibleIds.push(`${senderId}-${receiverId}`);
          newMessage._possibleIds.push(`${receiverId}-${senderId}`);
          
          // Individual IDs
          newMessage._possibleIds.push(senderId.toString());
          newMessage._possibleIds.push(receiverId.toString());
          
          console.log(`Generated possible conversation IDs for message:`, newMessage._possibleIds);
          
          // If we don't have a conversation ID yet, use the standard format
          if (!newMessage.conversationId) {
            newMessage.conversationId = standardRoomId;
            console.log(`Constructed conversation ID for direct message: ${newMessage.conversationId}`);
          }
        } else {
          console.warn('Could not generate possible IDs due to missing sender or receiver ID');
        }
        
        // Log active conversation when receiving a DM to help debug
        if (activeConversation) {
          console.log('Current active conversation:', {
            id: activeConversation._id,
            userId: activeConversation.userId,
            username: activeConversation.username
          });
        }
      }
      
      // Handle message updates
      setMessages(prev => {
        // Case 1: Check if message with this ID already exists
        const existingMessageIndex = prev.findIndex(msg => msg._id === newMessage._id);
        if (existingMessageIndex !== -1) {
          console.log('Message already exists in state, skipping:', newMessage._id);
          return prev;
        }
        
        // Case 2: Check if this is a server confirmation of a temporary message
        // The tempId field is passed with emitted event and returned in the server response
        const tempMessageIndex = prev.findIndex(msg => 
          newMessage.tempId && msg._id === `temp-${newMessage.tempId}`
        );
        
        if (tempMessageIndex !== -1) {
          console.log('Replacing temporary message with server version:', newMessage.tempId);
          const updatedMessages = [...prev];
          updatedMessages[tempMessageIndex] = {
            ...newMessage,
            pending: false // Clear the pending flag
          };
          return updatedMessages;
        }
        
        // Case 3: For direct messages, check if this message belongs to our current conversation
        if (messageType === 'direct' && activeConversation) {
          // Generate all possible IDs for the active conversation
          const activeConversationIds = [
            activeConversation._id,
            activeConversation.userId,
            activeConversation.conversationId
          ].filter(Boolean); // Remove undefined values
          
          // If user is in the conversation, add combination IDs
          if (user?._id && (activeConversation._id || activeConversation.userId)) {
            const otherId = activeConversation._id || activeConversation.userId;
            
            // Add sorted standard format
            const sortedIds = [user._id.toString(), otherId.toString()].sort();
            activeConversationIds.push(`dm_${sortedIds[0]}_${sortedIds[1]}`);
            
            // Add direct combinations
            activeConversationIds.push(`${user._id}-${otherId}`);
            activeConversationIds.push(`${otherId}-${user._id}`);
          }
          
          // Check for any intersection between message IDs and active conversation IDs
          const belongsToActiveConversation = newMessage._possibleIds && 
            newMessage._possibleIds.some(id => activeConversationIds.includes(id));
          
          // Special check for real MongoDB conversation ID (highest priority)
          const hasMatchingConversationId = 
            newMessage.conversationId && activeConversation._id && 
            newMessage.conversationId.toString() === activeConversation._id.toString();
          
          // If neither check passes, this message is not for the active conversation
          if (!belongsToActiveConversation && !hasMatchingConversationId) {
            console.log(`Message is not for active conversation.`);
            console.log(`Message possible IDs:`, newMessage._possibleIds);
            console.log(`Active conversation IDs:`, activeConversationIds);
            
            // Don't add to the current message list
            return prev;
          } else {
            console.log(`Message BELONGS to active conversation!`);
          }
        }
        
        // Case 4: This is a completely new message for our current conversation
        // Ensure messages are in chronological order
        const updatedMessages = [...prev, newMessage];
        return updatedMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt || Date.now());
          const timeB = new Date(b.timestamp || b.createdAt || Date.now());
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
      
      // Handle unread count for direct messages
      if (messageType === 'direct' && 
          newMessage.sender && user && newMessage.sender._id !== user._id) {
        
        // Check if this message is from a different sender than our active conversation
        const isFromDifferentSender = !activeConversation || 
          (activeConversation._id !== newMessage.sender._id && 
           activeConversation.userId !== newMessage.sender._id);
        
        if (isFromDifferentSender) {
          setUnreadMessages(prev => ({
            ...prev,
            [newMessage.sender._id]: (prev[newMessage.sender._id] || 0) + 1
          }));
          console.log(`Incremented unread count for ${newMessage.sender._id}`);
        }
      }
      
    } catch (error) {
      console.error('Error handling received message:', error);
      console.error('Problematic message data:', data);
    }
  }, [activeConversation, user]);

  // Handler for receiving previous messages
  const handlePreviousMessages = useCallback((receivedMessages) => {
    setMessages(receivedMessages);
    setLoading(false);
  }, []);

  // Handler for initial messages
  const handleInitialMessages = useCallback((data) => {
    console.log('Received initial messages:', {
      type: data?.type,
      channel: data?.channel,
      messageCount: data?.messages?.length || 0
    });
    
    if (data && data.messages && Array.isArray(data.messages)) {
      // Ensure we're still on the same conversation that requested these messages
      const currentConversationId = 
        conversationType === 'channel' ? 
          (activeConversation?.name || activeConversation?.id || activeConversation?._id) : 
          activeConversation?._id;
          
      const isMatchingConversation = 
        data.channel && 
        currentConversationId && 
        String(data.channel).toLowerCase() === String(currentConversationId).toLowerCase();
      
      if (!isMatchingConversation) {
        console.warn('Received messages for a different conversation than currently active', {
          current: currentConversationId,
          received: data.channel
        });
        // We'll still process the messages if they belong to the correct type
      }
      
      // Ensure messages are sorted by timestamp
      const sortedMessages = [...data.messages].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt);
        const timeB = new Date(b.timestamp || b.createdAt);
        return timeA - timeB;
      });
      
      setMessages(sortedMessages);
      setLoading(false);
      
      console.log(`Processed ${sortedMessages.length} messages for ${data.type} ${data.channel}`);
    } else {
      console.error('Received malformed initial messages:', data);
      setLoading(false);
      toast.error('Error loading messages');
    }
  }, [conversationType, activeConversation]);

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
    // Log to help debug typing indicators
    console.log('Typing status received:', { channel, username, isTyping });
    
    if (!activeConversation) {
      return; // No active conversation to show typing in
    }
    
    // For channel conversations
    if (conversationType === 'channel') {
      const channelId = activeConversation.id || activeConversation._id || activeConversation.name;
      if (channel === channelId) {
        setTyping(isTyping ? username : null);
        console.log(`${isTyping ? 'Showing' : 'Hiding'} typing indicator for ${username} in channel ${channel}`);
        return;
      }
    }
    
    // For direct message conversations
    if (conversationType === 'direct') {
      // Get all possible ID formats for the active conversation
      const conversationIds = [
        activeConversation._id,
        activeConversation.userId,
        // Create combined IDs in both orders
        `${user._id}-${activeConversation._id}`,
        `${activeConversation._id}-${user._id}`,
        `${user._id}-${activeConversation.userId}`,
        `${activeConversation.userId}-${user._id}`
      ].filter(Boolean); // Remove any undefined values
      
      // Check if the channel matches any of our possible IDs
      if (conversationIds.includes(channel)) {
        setTyping(isTyping ? username : null);
        console.log(`${isTyping ? 'Showing' : 'Hiding'} typing indicator for ${username} in direct message`);
        return;
      }
      
      // Also check if the channel is a formatted DM ID with our IDs
      if (user && activeConversation) {
        const myId = user._id;
        const theirId = activeConversation._id || activeConversation.userId;
        
        if (theirId) {
          // Sort IDs to match the DM_ID1_ID2 format
          const sortedIds = [myId.toString(), theirId.toString()].sort();
          const dmChannel = `dm_${sortedIds[0]}_${sortedIds[1]}`;
          
          if (channel === dmChannel) {
            setTyping(isTyping ? username : null);
            console.log(`${isTyping ? 'Showing' : 'Hiding'} typing indicator for ${username} in DM channel ${dmChannel}`);
            return;
          }
        }
      }
    }
    
    // If we get here, the typing status is not for our current conversation
    console.log('Typing status not for current conversation');
  }, [activeConversation, conversationType, user]);

  // Handler for legacy direct message format (backward compatibility)
  const handleDirectMessage = useCallback((message) => {
    console.log('Received direct message via legacy event:', message);
    if (!message) {
      console.error('Received invalid direct message format');
      return;
    }
    
    // Enhanced handling of legacy direct message format
    // Make sure we have the required fields
    const enhancedMessage = {
      ...message,
      messageType: 'direct' // Ensure message type is set
    };
    
    // Ensure sender and receiver IDs are properly set
    if (enhancedMessage.sender && typeof enhancedMessage.sender === 'object') {
      enhancedMessage.sender._id = enhancedMessage.sender._id || enhancedMessage.sender.userId || enhancedMessage.senderId;
    }
    
    if (enhancedMessage.receiver && typeof enhancedMessage.receiver === 'object') {
      enhancedMessage.receiver._id = enhancedMessage.receiver._id || enhancedMessage.receiver.userId || enhancedMessage.receiverId;
    }
    
    // Log for debugging
    console.log('Enhanced legacy direct message:', {
      id: enhancedMessage._id,
      from: enhancedMessage.sender?.username || enhancedMessage.sender?._id,
      to: enhancedMessage.receiver?.username || enhancedMessage.receiver?._id
    });
    
    // Process the direct message in the same format as messageReceived
    handleMessageReceived({
      type: 'direct',
      message: enhancedMessage
    });
  }, [handleMessageReceived]);

  // Handler for global direct message broadcasts
  const handleGlobalDirectMessage = useCallback((data) => {
    // Only process if we are one of the intended recipients
    if (user && data.intendedRecipients && 
        data.intendedRecipients.includes(user._id.toString())) {
      console.log('Received global direct message that is intended for us');
      handleMessageReceived(data);
    }
  }, [handleMessageReceived, user]);
  
  // Handler for targeted direct messages
  const handleTargetedDirectMessage = useCallback((data) => {
    console.log('Received targeted direct message');
    handleMessageReceived({
      type: 'direct',
      message: data
    });
  }, [handleMessageReceived]);
  
  // Set up event listeners
  useEffect(() => {
    if (!connected) return;
    
    // Register event listeners
    const cleanupFunctions = [
      onEvent('previousMessages', handlePreviousMessages),
      onEvent('initialMessages', handleInitialMessages),
      onEvent('messageReceived', handleMessageReceived),    // Unified message event
      onEvent('directMessage', handleDirectMessage),        // Legacy direct message event for backward compatibility
      onEvent('messageDeleted', handleMessageDeleted),
      onEvent('userTyping', ({ channel, username }) => handleTypingStatus({ channel, username, isTyping: true })),
      onEvent('userStopTyping', ({ channel }) => handleTypingStatus({ channel, isTyping: false })),
      // Add the new global direct message handler
      onEvent('globalDirectMessage', handleGlobalDirectMessage)
    ];
    
    // Add any user-specific event handlers if user is logged in
    if (user && user._id) {
      // For messages TO other users
      cleanupFunctions.push(
        onEvent(`directMessageTo:${user._id}`, handleTargetedDirectMessage)
      );
      
      // For messages FROM other users
      cleanupFunctions.push(
        onEvent(`directMessageFrom:${user._id}`, handleTargetedDirectMessage)
      );
    }
    
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
    handleDirectMessage,
    handleMessageDeleted,
    handleTypingStatus,
    handleGlobalDirectMessage,
    handleTargetedDirectMessage,
    user
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
      setMessages, // Add setMessages to the context
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

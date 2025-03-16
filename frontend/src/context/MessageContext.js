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
      // Create a unique tempId that includes the user's ID to ensure uniqueness across different users
      const tempId = `${user._id}-${timestamp.getTime()}-${Math.floor(Math.random() * 10000)}`;
      
      // Create a temporary message with consistent ID handling
      const tempMessage = {
        _id: tempId, // Use tempId directly as _id
        content: content.trim(),
        sender: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        timestamp,
        pending: true,
        tempId // Store tempId for matching with server response
      };
      
      console.log('[MESSAGE] Created temporary message:', {
        _id: tempMessage._id,
        tempId: tempMessage.tempId,
        content: tempMessage.content.substring(0, 20)
      });
      
      console.log(`Sending ${conversationType} message:`, {
        content: content.trim(),
        to: conversationType === 'direct' ? activeConversation.username : activeConversation.name
      });
      
      // Handle based on conversation type
      if (conversationType === 'direct') {
        // Use username if available (for better user identification), otherwise use _id
        const receiverId = activeConversation.username || activeConversation._id;
        
        console.log('Sending DM to:', receiverId);
        
        // Emit direct message event
        const messagePayload = {
          content: content.trim(),
          receiverId,
          tempId // Use tempId from above
        };
        
        console.log('[MESSAGE] Sending direct message:', {
          to: receiverId,
          tempId,
          content: content.trim().substring(0, 20)
        });
        
        emitEvent('directMessage', messagePayload);
        
        // Mark message as from self and add to state
        tempMessage.fromSelf = true;
        
        // Add message to state with duplicate prevention
        setMessages(prev => {
          // Check for any kind of duplicate using tempId or content matching
          const isDuplicate = prev.some(msg => {
            // Check tempId match first
            if (msg.tempId && msg.tempId === tempMessage.tempId) {
              console.log('[MESSAGE] Found duplicate by tempId:', msg.tempId);
              return true;
            }
            
            // Check content + sender + time match as fallback
            const contentMatch = msg.content === tempMessage.content;
            const senderMatch = msg.sender?._id === tempMessage.sender?._id;
            const timeMatch = Math.abs(
              new Date(msg.timestamp || msg.createdAt) - 
              new Date(tempMessage.timestamp || tempMessage.createdAt)
            ) < 2000; // Reduced time window for stricter matching
            
            const isMatch = contentMatch && senderMatch && timeMatch;
            if (isMatch) {
              console.log('[MESSAGE] Found content match:', {
                existing: msg._id,
                new: tempMessage._id,
                content: msg.content.substring(0, 20)
              });
              console.log('[MESSAGE] Found duplicate by content match');
              return true;
            }
            
            return false;
          });
          
          if (isDuplicate) {
            console.log('[MESSAGE] Prevented duplicate message:', tempMessage.tempId);
            return prev;
          }
          
          // Add new message and sort by timestamp
          const updatedMessages = [...prev, tempMessage].sort((a, b) => 
            new Date(a.timestamp || a.createdAt || Date.now()) -
            new Date(b.timestamp || b.createdAt || Date.now())
          );
          
          console.log('[MESSAGE] Added message to state:', {
            _id: tempMessage._id,
            tempId: tempMessage.tempId,
            total: updatedMessages.length
          });
          
          return updatedMessages;
        });
      } else {
        // Handle channel messages
        const channelName = activeConversation.name || 
          (typeof activeConversation === 'string' ? activeConversation : 
           activeConversation.id || activeConversation._id);
        
        if (!channelName) {
          console.error('[CHANNEL] Cannot send message: Missing channel name', activeConversation);
          toast.error('Cannot send message to this channel');
          return false;
        }
        
        // Add channel info to temp message
        tempMessage.channel = channelName;
        tempMessage.messageType = 'channel';
        
        console.log('[CHANNEL] Sending message:', {
          channel: channelName,
          tempId: tempMessage.tempId,
          content: content.trim().substring(0, 20)
        });
        
        // Emit channel message with consistent payload
        emitEvent('channelMessage', {
          content: content.trim(),
          channel: channelName,
          tempId: tempMessage.tempId
        });
        
        // Add message to state for channel messages
        setMessages(prev => {
          const isDuplicate = prev.some(msg => {
            if (msg.tempId && msg.tempId === tempMessage.tempId) {
              return true;
            }

            const contentMatch = msg.content === tempMessage.content;
            const senderMatch = msg.sender?._id === tempMessage.sender?._id;
            const timeMatch = Math.abs(
              new Date(msg.timestamp || msg.createdAt) - 
              new Date(tempMessage.timestamp || tempMessage.createdAt)
            ) < 2000;

            return contentMatch && senderMatch && timeMatch;
          });

          if (isDuplicate) {
            return prev;
          }

          return [...prev, tempMessage].sort((a, b) => 
            new Date(a.timestamp || a.createdAt || Date.now()) -
            new Date(b.timestamp || b.createdAt || Date.now())
          );
        });
      }
      
      // Removed redundant setMessages call
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
    if (!data) {
      console.error('Received null or undefined message data');
      return;
    }
    
    try {
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
        // Instead of just logging an error, assign an ID to the message
        console.log('Fixing message missing _id');
        newMessage._id = newMessage.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        // Also ensure 'id' field is consistent with '_id'
        newMessage.id = newMessage._id;
      }
      
      // Enhanced duplicate detection for all messages
      const isDuplicate = messages.some(msg => {
        // Check for exact ID matches first
        if (msg._id === newMessage._id || msg.id === newMessage._id || msg._id === newMessage.id) {
          console.log('Found exact ID match, skipping duplicate');
          return true;
        }

        // For messages from the same sender, do content + timestamp comparison
        if (msg.sender?._id === newMessage.sender?._id || msg.sender?.username === newMessage.sender?.username) {
          const contentMatch = msg.content === newMessage.content;
          const msgTime = new Date(msg.timestamp || msg.createdAt || Date.now());
          const newTime = new Date(newMessage.timestamp || newMessage.createdAt || Date.now());
          const timeMatch = Math.abs(msgTime - newTime) < 5000; // 5 second window

          if (contentMatch && timeMatch) {
            console.log('Found content+time match from same sender, skipping duplicate');
            return true;
          }
        }

        // For messages with tempId, check if we already have a message with this tempId
        if (newMessage.tempId && (msg._id === newMessage.tempId || msg.id === newMessage.tempId)) {
          console.log('Found tempId match, skipping duplicate');
          return true;
        }

        return false;
      });

      if (isDuplicate) {
        console.log('Skipping duplicate message:', {
          id: newMessage._id,
          tempId: newMessage.tempId,
          sender: newMessage.sender?.username,
          content: newMessage.content.substring(0, 20)
        });
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
      
      try {
        // Handle message updates
        setMessages(prev => {
          // Log incoming message details
          console.log('[MESSAGE UPDATE] Processing message:', {
            _id: newMessage._id,
            tempId: newMessage.tempId,
            sender: newMessage.sender?.username,
            content: newMessage.content.substring(0, 20)
          });
          
          // First check if we already have this message
          const existingMessage = prev.find(msg => {
            // Check exact ID match
            if (msg._id === newMessage._id) {
              console.log('[MESSAGE UPDATE] Found exact ID match:', msg._id);
              return true;
            }
            
            // Check tempId match (for pending -> confirmed)
            if (msg.tempId && newMessage.tempId && msg.tempId === newMessage.tempId) {
              console.log('[MESSAGE UPDATE] Found tempId match:', msg.tempId);
              return true;
            }
            
            // Check content + sender + time match as fallback
            const contentMatch = msg.content === newMessage.content;
            const senderMatch = msg.sender?._id === newMessage.sender?._id;
            const timeMatch = Math.abs(
              new Date(msg.timestamp || msg.createdAt) - 
              new Date(newMessage.timestamp || newMessage.createdAt)
            ) < 2000; // Reduced from 5000ms to 2000ms for stricter matching
            
            const isMatch = contentMatch && senderMatch && timeMatch;
            if (isMatch) {
              console.log('[MESSAGE UPDATE] Found content match:', {
                existingId: msg._id,
                existingTempId: msg.tempId,
                newId: newMessage._id,
                newTempId: newMessage.tempId,
                content: msg.content.substring(0, 20)
              });
            }
            return isMatch;
          });
          
          if (existingMessage) {
            // If this is a confirmation of a pending message, update it
            if (existingMessage.pending && !newMessage.pending) {
              console.log('[MESSAGE UPDATE] Confirming pending message:', {
                tempId: existingMessage.tempId,
                newId: newMessage._id
              });
              
              return prev.map(msg =>
                msg.tempId === existingMessage.tempId
                  ? { ...newMessage, pending: false }
                  : msg
              );
            }
            
            // Otherwise, it's a true duplicate - ignore it
            console.log('[MESSAGE UPDATE] Ignoring duplicate message:', {
              existingId: existingMessage._id,
              newId: newMessage._id,
              content: newMessage.content.substring(0, 20)
            });
            return prev;
          }
          
          // For direct messages, verify this belongs to the current conversation
          if (messageType === 'direct' && activeConversation) {
            console.log('[MESSAGE UPDATE] Checking conversation match:', {
              messageId: newMessage._id,
              conversationId: newMessage.conversationId,
              activeConversationId: activeConversation._id
            });
            
            // Build list of valid IDs for the active conversation
            const validConversationIds = new Set([
              // Direct IDs
              activeConversation._id?.toString(),
              activeConversation.userId?.toString(),
              // Special format
              activeConversation.conversationId?.toString()
            ].filter(Boolean));
            
            // Add dm_ format ID if we have both user IDs
            if (user?._id && (activeConversation._id || activeConversation.userId)) {
              const otherId = activeConversation._id || activeConversation.userId;
              const [id1, id2] = [user._id.toString(), otherId.toString()].sort();
              validConversationIds.add(`dm_${id1}_${id2}`);
            }
            
            console.log('[MESSAGE UPDATE] Valid conversation IDs:', 
              Array.from(validConversationIds));
            
            // Check if message belongs to this conversation
            const belongsToConversation = 
              // Check conversation ID match
              (newMessage.conversationId && 
               validConversationIds.has(newMessage.conversationId.toString())) ||
              // Check possible IDs match
              (newMessage._possibleIds && 
               newMessage._possibleIds.some(id => validConversationIds.has(id)));
            
            // Check message relevance by usernames and IDs
            const isRelevantConversation = (
              // Sender matches active conversation
              newMessage.sender?.username === activeConversation.username ||
              // Receiver matches active conversation
              newMessage.receiver?.username === activeConversation.username ||
              // Current user is receiver
              newMessage.receiver?.username === user.username ||
              // Current user is sender
              newMessage.sender?.username === user.username
            );
            
            console.log('[MESSAGE UPDATE] Conversation relevance:', {
              messageId: newMessage._id,
              tempId: newMessage.tempId,
              isRelevant: isRelevantConversation,
              belongsToConversation,
              sender: newMessage.sender?.username,
              receiver: newMessage.receiver?.username,
              activeUser: activeConversation.username
            });
            
            // Skip if message doesn't belong to this conversation
            if (!belongsToConversation && !isRelevantConversation) {
              console.log('[MESSAGE UPDATE] Message not for active conversation:', {
                messageId: newMessage._id,
                conversationId: newMessage.conversationId
              });
              return prev;
            }
            
            // Check for duplicates with comprehensive matching
            const isDuplicate = prev.some(msg => {
              // Check exact ID match
              if (msg._id === newMessage._id) {
                console.log('[MESSAGE UPDATE] Found exact ID match:', msg._id);
                return true;
              }
              
              // Check tempId match
              if (msg.tempId && newMessage.tempId && msg.tempId === newMessage.tempId) {
                console.log('[MESSAGE UPDATE] Found tempId match:', msg.tempId);
                return true;
              }
              
              // Check content + sender + time match as fallback
              const contentMatch = msg.content === newMessage.content;
              const senderMatch = msg.sender?._id === newMessage.sender?._id;
              const timeMatch = Math.abs(
                new Date(msg.timestamp || msg.createdAt) - 
                new Date(newMessage.timestamp || newMessage.createdAt)
              ) < 2000; // Reduced time window for stricter matching
              
              const isMatch = contentMatch && senderMatch && timeMatch;
              if (isMatch) {
                console.log('[MESSAGE UPDATE] Found content match:', {
                  existingId: msg._id,
                  existingTempId: msg.tempId,
                  newId: newMessage._id,
                  newTempId: newMessage.tempId,
                  content: msg.content.substring(0, 20)
                });
              }
              return isMatch;
            });
            
            if (isDuplicate) {
              console.log('[MESSAGE UPDATE] Prevented duplicate message:', {
                _id: newMessage._id,
                tempId: newMessage.tempId,
                content: newMessage.content.substring(0, 20)
              });
              return prev;
            }
          }
          
          // Add new message with consistent ID handling
          const messageToAdd = {
            ...newMessage,
            _id: newMessage._id || newMessage.tempId,
            timestamp: newMessage.timestamp || newMessage.createdAt || Date.now(),
            pending: false
          };
          
          return [...prev, messageToAdd].sort((a, b) => {
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
    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Failed to process message');
    }
  }, [activeConversation, user, messages]);

  // Handler for receiving previous messages
  const handlePreviousMessages = useCallback((receivedMessages) => {
    try {
      setMessages(receivedMessages);
      setLoading(false);
    } catch (error) {
      console.error('Error handling previous messages:', error);
      setLoading(false);
    }
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
  
  // Handler for message confirmation (prevents duplicate messages)
  const handleDirectMessageConfirmation = useCallback((data) => {
    console.log('Received message confirmation:', data._id);
    
    // We don't need to add this message to the state since we already have
    // a local copy. Instead, we just update the existing message to mark it
    // as confirmed/delivered.
    setMessages(prev => {
      // Find the message by content and timestamp (approximate match)
      const messageIndex = prev.findIndex(msg => 
        msg.content === data.content && 
        msg.sender?.username === user?.username &&
        Math.abs(new Date(msg.timestamp || msg.createdAt) - new Date(data.timestamp)) < 5000
      );
      
      if (messageIndex !== -1) {
        // Update the message to use the server-assigned ID and mark as delivered
        const updatedMessages = [...prev];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          _id: data._id,         // Use server-assigned ID
          id: data._id,          // Keep both ID formats consistent
          pending: false,        // Mark as delivered
          delivered: true        // Explicit delivery confirmation
        };
        return updatedMessages;
      }
      
      // If we couldn't find the message, just return the current state
      return prev;
    });
  }, [user?.username]);
  
  // Set up event listeners
  useEffect(() => {
    if (!connected) return;
    
    // Register event listeners
    const cleanupFunctions = [
      onEvent('loadInitialMessages', handleInitialMessages),  // Updated to match backend event name
      onEvent('messageReceived', handleMessageReceived),    // Unified message event
      onEvent('directMessage', handleDirectMessage),        // Legacy direct message event for backward compatibility
      onEvent('directMessageConfirmation', handleDirectMessageConfirmation), // Handle message confirmations without duplicating
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
    handleDirectMessageConfirmation,
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
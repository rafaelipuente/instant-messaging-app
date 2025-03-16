const { Message, VALID_CHANNELS } = require('../models/messageModel');
const User = require('../models/userModel');
const Conversation = require('../models/channelModel');
const path = require('path');
const mongoose = require('mongoose');

// Helper function to transform message for client
const transformMessage = (message) => {
  const base = {
    _id: message._id,
    content: message.content,
    timestamp: message.createdAt || message.timestamp,
    sender: {
      _id: message.sender._id,
      username: message.sender.username,
      profilePicture: message.sender.profilePicture ? 
        `/uploads/${path.basename(message.sender.profilePicture)}` : null,
      status: message.sender.status
    },
    isDeleted: message.isDeleted || false
  };

  // Add channel info for public messages
  if (message.channel) {
    base.channel = message.channel;
  }

  // Add receiver info for direct messages
  if (message.receiver) {
    base.receiver = {
      _id: message.receiver._id,
      username: message.receiver.username,
      profilePicture: message.receiver.profilePicture ? 
        `/uploads/${path.basename(message.receiver.profilePicture)}` : null,
      status: message.receiver.status
    };
  }

  return base;
};

// Unified function to broadcast messages with reliability fallbacks
const broadcastMessage = (io, roomIds, message, type, tempId = null) => {
  const transformedMessage = transformMessage(message);
  
  // Add tempId to the message for client-side reconciliation
  if (tempId) {
    transformedMessage.tempId = tempId;
  }
  
  // Ensure roomIds is an array
  const rooms = Array.isArray(roomIds) ? roomIds : [roomIds];
  
  console.log(`[BROADCAST] Broadcasting ${type} message to rooms:`, rooms);
  console.log(`[BROADCAST] Message has tempId: ${tempId || 'none'}`);
  
  // Enhanced broadcasting with multiple mechanisms for reliability
  rooms.forEach(roomId => {
    if (!roomId) {
      console.error('[BROADCAST] Cannot broadcast to undefined room');
      return;
    }
    
    const roomName = roomId.toString();
    
    // Log connected clients in this room for debugging
    const roomClients = io.sockets.adapter.rooms.get(roomName);
    const clientCount = roomClients ? roomClients.size : 0;
    console.log(`[BROADCAST] Room ${roomName} has ${clientCount} connected clients`);
    
    // BROADCAST METHOD 1: Standard room broadcasting
    // Use the unified messageReceived event
    io.to(roomName).emit('messageReceived', {
      type,
      message: transformedMessage
    });
    
    // Also send the specific event type for backward compatibility
    const eventName = type === 'channel' ? 'channelMessage' : 'directMessage';
    io.to(roomName).emit(eventName, transformedMessage);
  });
  
  // BROADCAST METHOD 2: For direct messages, ensure sender and receiver get the message
  if (type === 'direct' && message.sender && message.receiver) {
    // Get sender and receiver IDs
    const senderId = message.sender._id.toString();
    const receiverId = message.receiver._id.toString();
    
    console.log(`[BROADCAST] Direct message from ${senderId} to ${receiverId}`);
    
    // Use the special namespaced direct message event for targeted delivery
    io.to(senderId).emit('directMessageTo:' + receiverId, transformedMessage);
    io.to(receiverId).emit('directMessageFrom:' + senderId, transformedMessage);
    
    // BROADCAST METHOD 3: Try to find and emit directly to all sockets of both users
    const allSockets = Array.from(io.sockets.sockets.values());
    
    // Find all sockets for both users
    const senderSockets = allSockets.filter(s => s.user && s.user._id.toString() === senderId);
    const receiverSockets = allSockets.filter(s => s.user && s.user._id.toString() === receiverId);
    
    console.log(`[BROADCAST] Found ${senderSockets.length} sender sockets and ${receiverSockets.length} receiver sockets`);
    
    // Emit to all sender sockets
    senderSockets.forEach(socket => {
      socket.emit('messageReceived', {
        type,
        message: transformedMessage
      });
      socket.emit(eventName, transformedMessage);
    });
    
    // Emit to all receiver sockets
    receiverSockets.forEach(socket => {
      socket.emit('messageReceived', {
        type,
        message: transformedMessage
      });
      socket.emit(eventName, transformedMessage);
    });
    
    // BROADCAST METHOD 4: Broadcast to all clients as a last resort (but only for direct messages)
    // This is not ideal but ensures delivery at the expense of unnecessarily notifying other users
    console.log(`[BROADCAST] Using fallback global broadcast for direct message reliability`);
    io.emit('globalDirectMessage', {
      type,
      message: transformedMessage,
      intendedRecipients: [senderId, receiverId]
    });
  }
  
  console.log(`[BROADCAST] Completed all broadcast methods for message ${transformedMessage._id}`);
  return transformedMessage;
};

const handleChannelMessage = async (io, socket, data) => {
  try {
    const { content, channel, tempId } = data;
    
    if (!content || content.trim().length === 0) {
      socket.emit('messageError', { error: 'Message content cannot be empty' });
      return;
    }
    
    console.log(`[CHANNEL] Processing message for channel: ${channel}`, data);
    
    // Always standardize channel names to lowercase and handle dash vs space conversion
    let channelName = channel ? channel.toLowerCase() : null;
    
    // Support both "tech-talk" and "tech talk" formats
    if (channelName === 'tech talk') channelName = 'tech-talk';
    if (channelName === 'tech') channelName = 'tech-talk';  // Legacy support

    console.log(`User ${socket.user.username} sent channel message to ${channelName}:`, content);
    
    // Validate channel
    if (!channelName) {
      console.error(`[CHANNEL] No channel name provided`);
      socket.emit('messageError', { error: 'Channel name is required' });
      return;
    }
    
    // Check against VALID_CHANNELS with more detailed logging
    console.log(`[CHANNEL] Validating channel "${channelName}" against:`, VALID_CHANNELS);
    if (!VALID_CHANNELS.includes(channelName)) {
      console.error(`[CHANNEL] Invalid channel name: ${channelName}`);
      socket.emit('messageError', { error: `Invalid channel name: ${channelName}. Valid channels are: ${VALID_CHANNELS.join(', ')}` });
      return;
    }

    console.log(`[CHANNEL] Message in ${channelName} from ${socket.user.username}`);

    // Find the channel conversation
    let conversation = await Conversation.findOne({ 
      name: channelName,
      type: 'channel'
    });

    // If channel doesn't exist, create it (unlikely, but as a fallback)
    if (!conversation) {
      console.log(`[CHANNEL] Creating new channel: ${channelName}`);
      conversation = await Conversation.create({
        name: channelName,
        displayName: channelName.charAt(0).toUpperCase() + channelName.slice(1),
        type: 'channel',
        createdBy: socket.user._id,
        isDefaultChannel: true
      });
    }

    // Create and save the channel message
    const message = new Message({
      sender: socket.user._id,
      content,
      channel: channelName
    });

    await message.save();
    await message.populate('sender', 'username profilePicture status');

    // Update channel's lastActivity
    conversation.lastActivity = new Date();
    await conversation.save();

    // Broadcast message to everyone in the channel - pass along the tempId
    return broadcastMessage(io, channelName, message, 'channel', tempId);
  } catch (error) {
    console.error('[CHANNEL] Error handling channel message:', error);
    console.error('[CHANNEL] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to send channel message' });
    throw error;
  }
};

const handleDirectMessage = async (io, socket, data) => {
  try {
    const { content, receiverId, tempId, conversationId } = data;
    const senderId = socket.user._id;

    console.log(`[DIRECT MESSAGE] Handling direct message from ${socket.user.username} to ${receiverId}, conversationId: ${conversationId || 'not provided'}`);

    if (!receiverId) {
      console.error('[DIRECT MESSAGE] No receiverId provided');
      socket.emit('messageError', { error: 'Receiver ID is required' });
      return null;
    }

    // Find or create the conversation between the users
    const conversation = await Conversation.findOrCreateDirectConversation(senderId, receiverId);
    
    // Create and save the message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      messageType: 'direct' // Ensure messageType is set correctly
    });
    
    // Add the conversation ID to the message object
    message.conversationId = conversation._id;

    await message.save();
    console.log(`[DIRECT MESSAGE] Direct message saved with ID: ${message._id}`);
    
    await message.populate('sender', 'username profilePicture status');
    await message.populate('receiver', 'username profilePicture status');

    // Update users' conversations
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    // Add conversation to users and update unread count
    await sender.addConversation(conversation._id);
    await receiver.addConversation(conversation._id);
    await receiver.incrementUnreadCount(conversation._id);

    // Update conversation's lastActivity
    conversation.lastActivity = new Date();
    await conversation.save();

    // Convert message to JSON to add additional properties
    const messageJson = message.toObject();
    messageJson.conversationId = conversation._id;
    
    // Log broadcast activity for debugging
    console.log(`[DIRECT MESSAGE] Broadcasting message to users: ${senderId} and ${receiverId}`);
    console.log(`[DIRECT MESSAGE] Message content: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`);
    
    // Add conversation ID to message for better routing
    const conversationStr = conversation._id.toString();
    messageJson.conversationId = conversationStr;
    
    // Create a standard conversation room ID format
    const sortedIds = [senderId.toString(), receiverId.toString()].sort();
    const conversationRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    
    // Define all rooms where this message should be broadcast
    const rooms = [
      senderId.toString(),         // Sender's user room
      receiverId.toString(),       // Receiver's user room
      conversationStr,             // Database conversation ID
      conversationRoomId           // Standardized conversation room
    ];
    
    console.log(`[DIRECT MESSAGE] Broadcasting to multiple rooms for reliability: ${rooms.join(', ')}`);
    
    // Use the unified broadcast function for reliable delivery
    // This handles all broadcasting strategies including direct socket emission and global fallback
    const transformedMessage = broadcastMessage(io, rooms, message, 'direct', tempId);
    
    // Log which rooms received this message
    console.log(`[DIRECT MESSAGE] Message ${messageJson._id} broadcast complete to all possible rooms`);
    
    // Return the message including the conversation ID for reference
    transformedMessage.conversationId = conversationStr;
    
    return transformedMessage;
  } catch (error) {
    console.error('[DIRECT MESSAGE] Error handling direct message:', error);
    console.error('[DIRECT MESSAGE] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to send direct message' });
    throw error;
  }
};

const handleMessageDeletion = async (io, socket, data) => {
  try {
    const { messageId } = data;
    
    if (!messageId) {
      throw new Error('Missing message ID');
    }

    console.log(`[DELETE] Processing delete request for message ${messageId} from user ${socket.user._id}`);
    
    // Find the message
    const message = await Message.findById(messageId)
      .populate('sender', 'username')
      .populate('receiver', 'username');
    
    if (!message) {
      console.error(`[DELETE] Message ${messageId} not found`);
      socket.emit('messageError', { error: 'Message not found' });
      return null;
    }
    
    // Check if the user is authorized to delete this message
    if (message.sender._id.toString() !== socket.user._id.toString()) {
      console.error(`[DELETE] User ${socket.user._id} not authorized to delete message ${messageId}`);
      socket.emit('messageError', { error: 'Not authorized to delete this message' });
      return null;
    }
    
    // Mark message as deleted rather than physically deleting it
    message.isDeleted = true;
    message.content = "This message has been deleted";
    await message.save();
    
    console.log(`[DELETE] Message ${messageId} marked as deleted`);
    
    // Broadcast deletion event
    if (message.channel && VALID_CHANNELS.includes(message.channel)) {
      // Channel message - broadcast to everyone in the channel
      console.log(`[DELETE] Broadcasting deletion to channel ${message.channel}`);
      io.to(message.channel).emit('messageDeleted', { messageId });
    } else {
      // Direct message - send to both participants
      const senderId = message.sender._id.toString();
      const receiverId = message.receiver._id.toString();
      
      console.log(`[DELETE] Broadcasting deletion to users ${senderId} and ${receiverId}`);
      io.to(senderId).emit('messageDeleted', { messageId });
      io.to(receiverId).emit('messageDeleted', { messageId });
    }
    
    return { success: true, messageId };
  } catch (error) {
    console.error('[DELETE] Error handling message deletion:', error);
    console.error('[DELETE] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to delete message' });
    return null;
  }
};

// Request tracking for throttling
const requestTracker = {
  requests: {},
  isThrottled(key) {
    const now = Date.now();
    const request = this.requests[key] || { count: 0, lastTime: 0 };
    const timeWindow = now - request.lastTime;
    
    // Allow 3 requests per 5 seconds
    if (timeWindow < 5000 && request.count >= 3) {
      return true;
    }
    
    this.requests[key] = {
      count: request.count + 1,
      lastTime: now
    };
    return false;
  }
};

const loadInitialMessages = async (io, socket, data) => {
  try {
    const { id, channel, type, limit = 50 } = data;
    
    // Track requests to prevent loops
    const requestKey = `${socket.id}:${type}:${id || channel}`;
    if (requestTracker.isThrottled(requestKey)) {
      console.warn(`[THROTTLE] Too many requests for ${requestKey}`);
      socket.emit('loadInitialMessages', {
        error: 'Too many requests. Please wait a few seconds.',
        throttled: true
      });
      return;
    }
    
    console.log(`[LOAD] Loading initial messages:`, {
      id, channel, type, limit,
      user: socket.user.username
    });
    
    // Use either id or channel parameter (for backward compatibility)
    let conversationId = id || channel;
    
    if (!conversationId) {
      console.error('[LOAD] Missing conversationId in loadInitialMessages');
      socket.emit('loadInitialMessages', { error: 'Channel or conversation ID is required' });
      return;
    }
    
    // Join the room for this conversation if not already joined
    if (type === 'channel') {
      const roomName = conversationId.toString().toLowerCase();
      // Check if socket is in the room using Socket.IO's built-in method
      const rooms = Array.from(socket.rooms || []);
      const alreadyInRoom = rooms.includes(roomName);
      
      if (!alreadyInRoom) {
        console.log(`[LOAD] Joining user ${socket.user.username} to channel room: ${roomName}`);
        socket.join(roomName);
      }
    }
    
    // Handle standard public channels by name (like 'general', 'tech-talk', etc.)
    if (type === 'channel') {
      // Standard channel - use lowercase name
      const channelName = conversationId.toLowerCase();
      console.log(`[LOAD] Loading messages for channel: ${channelName}`);
      
      try {
        // Use the static method for getting channel messages
        const messages = await Message.getChannelMessages(channelName, Number(limit));
        if (!messages) {
          console.error(`[LOAD] No messages found for channel: ${channelName}`);
          socket.emit('loadInitialMessages', { 
            error: 'No messages found',
            type: 'channel',
            channel: channelName
          });
          return;
        }
        
        console.log(`[LOAD] Found ${messages.length} channel messages`);
        
        // Transform and send messages - important to pass the correct event name
        const transformedMessages = messages.map(transformMessage).reverse(); // Reverse to get chronological order
        console.log(`[LOAD] Emitting ${transformedMessages.length} channel messages for ${channelName}`);
        socket.emit('loadInitialMessages', {
          channel: channelName,
          messages: transformedMessages,
          type: 'channel',
          timestamp: new Date().toISOString()
        });
        
        return transformedMessages;
      } catch (error) {
        console.error(`[LOAD] Error loading channel messages:`, error);
        socket.emit('loadInitialMessages', { 
          error: 'Error loading channel messages',
          type: 'channel',
          channel: channelName
        });
        return;
      }
      
      console.log(`[LOAD] Found ${messages.length} channel messages`);
      
      // Transform and send messages - important to pass the correct event name
      const transformedMessages = messages.map(transformMessage).reverse(); // Reverse to get chronological order
      console.log(`[LOAD] Emitting ${transformedMessages.length} channel messages for ${channelName}`);
      socket.emit('loadInitialMessages', {
        channel: channelName,
        messages: transformedMessages,
        type: 'channel',
        timestamp: new Date().toISOString()
      });
      
      return transformedMessages;
    } else if (type === 'direct') {
      // It's a direct message conversation
      try {
        // Validate if the ID is a valid ObjectId (for DB lookup)
        try {
          // Store original value for response
          const originalId = conversationId;
          // Validate ObjectId format
          if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            throw new Error('Invalid conversation ID format');
          }
          conversationId = new mongoose.Types.ObjectId(conversationId);
          
          const conversation = await Conversation.findById(conversationId);
          
          if (!conversation) {
            console.error(`[LOAD] Conversation not found: ${conversationId}`);
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          if (conversation.type === 'direct') {
            // Get the participants
            const participants = conversation.participants;
            if (!participants || participants.length !== 2) {
              throw new Error('Invalid direct conversation participants');
            }
            
            try {
              // Load direct messages using the static method
              const messages = await Message.getDirectMessages(
                participants[0],
                participants[1],
                Number(limit)
              );
              
              if (!messages) {
                console.error(`[LOAD] No messages found for conversation: ${originalId}`);
                socket.emit('loadInitialMessages', { 
                  error: 'No messages found',
                  type: 'direct',
                  conversationId: originalId
                });
                return;
              }
              
              console.log(`[LOAD] Found ${messages.length} direct messages`);
              
              // Transform and send messages
              const transformedMessages = messages.map(transformMessage);
              console.log(`[LOAD] Emitting ${transformedMessages.length} direct messages for conversation ${originalId}`);
              socket.emit('loadInitialMessages', {
                conversationId: originalId,
                messages: transformedMessages,
                type: 'direct',
                timestamp: new Date().toISOString()
              });
              
              return transformedMessages;
            } catch (error) {
              console.error(`[LOAD] Error loading direct messages:`, error);
              socket.emit('loadInitialMessages', { 
                error: 'Error loading direct messages',
                type: 'direct',
                conversationId: originalId
              });
              return;
            }
            
            // Transform and send messages
            const transformedMessages = messages.map(transformMessage);
            console.log(`[LOAD] Emitting ${transformedMessages.length} direct messages for conversation ${originalId}`);
            socket.emit('loadInitialMessages', {
              conversationId: originalId,
              messages: transformedMessages,
              type: 'direct',
              timestamp: new Date().toISOString()
            });
            
            return transformedMessages;
          } else {
            console.error(`[LOAD] Found conversation but it's not a direct type: ${conversation.type}`);
            socket.emit('error', { message: 'Invalid conversation type' });
            return;
          }
        } catch (error) {
          console.error('[LOAD] Error processing conversation ID:', error);
          socket.emit('loadInitialMessages', { 
            error: 'Invalid conversation ID format',
            errorType: 'INVALID_ID'
          });
          return;
        }
      } catch (error) {
        console.error('[LOAD] Error in loadInitialMessages:', error);
        socket.emit('error', { message: 'Error loading messages' });
      }
    } else {
      console.error(`[LOAD] Invalid message type: ${type}`);
      socket.emit('error', { message: 'Invalid message type' });
    }
  } catch (error) {
    console.error('[LOAD] Error in loadInitialMessages:', error);
    socket.emit('error', { message: 'Error loading messages' });
  }
};

const handleConnection = async (io, socket, connectedUsers) => {
  try {
    // Update user status to online
    await User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: new Date()
    });
    
    // Join rooms for all valid channels
    for (const channel of VALID_CHANNELS) {
      socket.join(channel);
      console.log(`[CONNECTION] User ${socket.user.username} joined channel ${channel}`);
    }
    
    // Join a room with the user's ID for direct messaging
    socket.join(socket.user._id.toString());
    console.log(`[CONNECTION] User ${socket.user.username} joined personal room ${socket.user._id}`);
    
    // Find all conversations for this user
    const user = await User.findById(socket.user._id).populate('conversations.conversationId');
    
    // Join rooms for all direct message conversations using multiple room formats
    for (const conv of user.conversations) {
      if (conv.conversationId && conv.conversationId.type === 'direct') {
        // STRATEGY 1: Join using MongoDB conversation ID
        const conversationId = conv.conversationId._id.toString();
        socket.join(conversationId);
        console.log(`[CONNECTION] User ${socket.user.username} joined conversation room ${conversationId}`);
        
        // STRATEGY 2: Join using unified conversation ID format
        // Find other participant
        const otherParticipant = conv.conversationId.participants.find(
          p => p.toString() !== socket.user._id.toString()
        );
        
        if (otherParticipant) {
          // Create standardized room ID with sorted user IDs
          const sortedIds = [socket.user._id.toString(), otherParticipant.toString()].sort();
          const conversationRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
          socket.join(conversationRoomId);
          console.log(`[CONNECTION] User ${socket.user.username} joined unified room ${conversationRoomId}`);
        }
      }
    }
    
    // Notify others that user is online
    socket.broadcast.emit('userConnected', {
      userId: socket.user._id,
      username: socket.user.username,
      status: 'online'
    });
    
    // Send online users to the newly connected user
    const onlineUsers = Array.from(connectedUsers.keys()).map(userId => ({
      userId,
      username: connectedUsers.get(userId).username,
      status: 'online'
    }));
    
    socket.emit('onlineUsers', onlineUsers);
    
    return true;
  } catch (error) {
    console.error('[CONNECTION] Error handling connection:', error);
    console.error('[CONNECTION] Error details:', error.stack);
    return false;
  }
};

const handleDisconnect = async (io, socket, connectedUsers) => {
  try {
    const userId = socket.user._id.toString();
    
    // Remove user from connected users
    connectedUsers.delete(userId);
    
    // Update user status to offline
    await User.findByIdAndUpdate(userId, { 
      status: 'offline',
      lastSeen: new Date()
    });
    
    // Notify other users
    io.emit('userDisconnected', { 
      userId,
      username: socket.user.username,
      status: 'offline'
    });
    
    console.log(`[DISCONNECT] User disconnected: ${socket.user.username} (${userId})`);
  } catch (error) {
    console.error('[DISCONNECT] Error handling disconnect:', error);
    console.error('[DISCONNECT] Error details:', error.stack);
  }
};

module.exports = {
  handleChannelMessage,
  handleDirectMessage,
  handleMessageDeletion,
  loadInitialMessages,
  handleConnection,
  handleDisconnect,
  VALID_CHANNELS
};

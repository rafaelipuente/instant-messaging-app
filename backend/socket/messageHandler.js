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
  
  // Update room names for channels to use a prefix
  const updatedRooms = rooms.map(room => {
    if (type === 'channel' && !room.startsWith('channel_')) {
      return `channel_${room}`;
    }
    return room;
  });

  console.log(`[BROADCAST] Broadcasting ${type} message to rooms:`, updatedRooms);
  console.log(`[BROADCAST] Message has tempId: ${tempId || 'none'}`);
  
  // Define event name once for all broadcast methods
  const eventName = type === 'channel' ? 'channelMessage' : 'directMessage';
  
  // Enhanced broadcasting with multiple mechanisms for reliability
  updatedRooms.forEach(roomId => {
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
    io.to(roomName).emit('messageReceived', {
      type,
      message: transformedMessage
    });
    
    // Also send the specific event type for backward compatibility
    io.to(roomName).emit(eventName, transformedMessage);
  });
  
  // BROADCAST METHOD 2: For direct messages, ensure sender and receiver get the message
  if (type === 'direct' && message.sender && message.receiver) {
    const senderId = message.sender._id.toString();
    const receiverId = message.receiver._id.toString();
    
    console.log(`[BROADCAST] Direct message from ${senderId} to ${receiverId}`);
    
    io.to(senderId).emit('directMessageTo:' + receiverId, transformedMessage);
    io.to(receiverId).emit('directMessageFrom:' + senderId, transformedMessage);
    
    // BROADCAST METHOD 3: Try to find and emit directly to all sockets of both users
    const allSockets = Array.from(io.sockets.sockets.values());
    
    const senderSockets = allSockets.filter(s => s.user && s.user._id.toString() === senderId);
    const receiverSockets = allSockets.filter(s => s.user && s.user._id.toString() === receiverId);
    
    console.log(`[BROADCAST] Found ${senderSockets.length} sender sockets and ${receiverSockets.length} receiver sockets`);
    
    senderSockets.forEach(socket => {
      socket.emit('messageReceived', { type, message: transformedMessage });
      socket.emit(eventName, transformedMessage);
    });
    
    receiverSockets.forEach(socket => {
      socket.emit('messageReceived', { type, message: transformedMessage });
      socket.emit(eventName, transformedMessage);
    });
    
    // BROADCAST METHOD 4: Broadcast to all clients as a last resort (but only for direct messages)
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
    
    let channelName = channel ? channel.toLowerCase() : null;
    
    if (channelName === 'tech talk') channelName = 'tech-talk';
    if (channelName === 'tech') channelName = 'tech-talk';

    console.log(`User ${socket.user.username} sent channel message to ${channelName}:`, content);
    
    if (!channelName) {
      console.error(`[CHANNEL] No channel name provided`);
      socket.emit('messageError', { error: 'Channel name is required' });
      return;
    }
    
    console.log(`[CHANNEL] Validating channel "${channelName}" against:`, VALID_CHANNELS);
    if (!VALID_CHANNELS.includes(channelName)) {
      console.error(`[CHANNEL] Invalid channel name: ${channelName}`);
      socket.emit('messageError', { error: `Invalid channel name: ${channelName}. Valid channels are: ${VALID_CHANNELS.join(', ')}` });
      return;
    }

    console.log(`[CHANNEL] Message in ${channelName} from ${socket.user.username}`);

    let conversation = await Conversation.findOne({ 
      name: channelName,
      type: 'channel'
    });

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

    const message = new Message({
      sender: socket.user._id,
      content,
      channel: channelName
    });

    await message.save();
    await message.populate('sender', 'username profilePicture status');

    conversation.lastActivity = new Date();
    await conversation.save();

    return broadcastMessage(io, channelName, message, 'channel', tempId);
  } catch (error) {
    console.error('[CHANNEL] Error handling channel message:', error);
    socket.emit('messageError', { error: 'Failed to send channel message' });
    throw error;
  }
};

const handleDirectMessage = async (io, socket, data) => {
  try {
    const { content, receiverId, tempId, conversationId, standardRoomId } = data;
    const senderId = socket.user._id;

    console.log(`[DIRECT MESSAGE] Handling direct message from ${socket.user.username} to ${receiverId}`, {
      conversationId: conversationId || 'not provided',
      standardRoomId: standardRoomId || 'not provided',
      tempId: tempId || 'not provided'
    });

    if (!receiverId) {
      console.error('[DIRECT MESSAGE] No receiverId provided');
      socket.emit('messageError', { error: 'Receiver ID is required' });
      return null;
    }

    const conversation = await Conversation.findOrCreateDirectConversation(senderId, receiverId);
    
    const messageId = new mongoose.Types.ObjectId();
    console.log('[DIRECT MESSAGE] Generated new message ID:', messageId.toString());
    
    const message = new Message({
      _id: messageId,
      sender: senderId,
      receiver: receiverId,
      content,
      messageType: 'direct',
      conversationId: conversation._id,
      tempId
    });
    
    await message.save();
    await message.populate('sender', 'username profilePicture status');
    await message.populate('receiver', 'username profilePicture status');
    
    console.log('[DIRECT MESSAGE] Saved message:', {
      _id: message._id?.toString() || 'unknown',
      tempId,
      sender: message.sender?.username || 'unknown',
      receiver: message.receiver?.username || 'unknown',
      conversationId: message.conversationId?.toString() || 'unknown'
    });

    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (sender) await sender.addConversation(conversation._id);
    if (receiver) await receiver.addConversation(conversation._id);
    if (receiver) await receiver.incrementUnreadCount(conversation._id);

    conversation.lastActivity = new Date();
    await conversation.save();

    const messageJson = message.toObject();
    messageJson._id = message._id;
    messageJson.conversationId = conversation._id;
    messageJson.tempId = tempId;
    
    console.log('[DIRECT MESSAGE] Broadcasting message:', {
      _id: messageJson._id?.toString() || 'unknown',
      tempId: messageJson.tempId,
      conversationId: messageJson.conversationId?.toString() || 'unknown',
      sender: messageJson.sender?.username || 'unknown',
      receiver: messageJson.receiver?.username || 'unknown',
      contentPreview: content.substring(0, 20) + (content.length > 20 ? '...' : '')
    });

    const conversationIdStr = conversation._id?.toString() || '';
    const senderIdStr = senderId?.toString() || '';
    const receiverIdStr = receiverId?.toString() || '';
    
    const sortedIds = [senderIdStr, receiverIdStr].filter(Boolean).sort();
    const conversationRoomId = standardRoomId || 
      (sortedIds.length === 2 ? 
        `dm_${sortedIds[0]}_${sortedIds[1]}` : 
        `dm_${senderIdStr}_${receiverIdStr}`);
    
    const rooms = [
      senderIdStr,
      receiverIdStr,
      conversationIdStr,
      conversationRoomId
    ].filter(Boolean); // Filter out any empty strings
    
    console.log(`[DIRECT MESSAGE] Broadcasting to multiple rooms for reliability: ${rooms.join(', ')}`);
    
    const transformedMessage = broadcastMessage(io, rooms, message, 'direct', tempId);
    
    console.log(`[DIRECT MESSAGE] Message ${messageJson._id} broadcast complete to all possible rooms`);
    
    if (transformedMessage) {
      transformedMessage.conversationId = conversationIdStr;
    }
    
    return transformedMessage;
  } catch (error) {
    console.error('[DIRECT MESSAGE] Error handling direct message:', error);
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
    
    const message = await Message.findById(messageId)
      .populate('sender', 'username')
      .populate('receiver', 'username');
    
    if (!message) {
      console.error(`[DELETE] Message ${messageId} not found`);
      socket.emit('messageError', { error: 'Message not found' });
      return null;
    }
    
    if (message.sender._id.toString() !== socket.user._id.toString()) {
      console.error(`[DELETE] User ${socket.user._id} not authorized to delete message ${messageId}`);
      socket.emit('messageError', { error: 'Not authorized to delete this message' });
      return null;
    }
    
    message.isDeleted = true;
    message.content = "This message has been deleted";
    await message.save();
    
    console.log(`[DELETE] Message ${messageId} marked as deleted`);
    
    if (message.channel && VALID_CHANNELS.includes(message.channel)) {
      console.log(`[DELETE] Broadcasting deletion to channel ${message.channel}`);
      io.to(`channel_${message.channel}`).emit('messageDeleted', { messageId });
    } else {
      const senderId = message.sender._id.toString();
      const receiverId = message.receiver._id.toString();
      
      console.log(`[DELETE] Broadcasting deletion to users ${senderId} and ${receiverId}`);
      io.to(senderId).emit('messageDeleted', { messageId });
      io.to(receiverId).emit('messageDeleted', { messageId });
    }
    
    return { success: true, messageId };
  } catch (error) {
    console.error('[DELETE] Error handling message deletion:', error);
    socket.emit('messageError', { error: 'Failed to delete message' });
    return null;
  }
};

const requestTracker = {
  requests: {},
  isThrottled(key) {
    const now = Date.now();
    const request = this.requests[key] || { count: 0, lastTime: 0 };
    const timeWindow = now - request.lastTime;
    
    // Allow more requests in a short time (10 in 2 seconds instead of 3 in 5 seconds)
    if (timeWindow < 2000 && request.count >= 10) {
      console.warn(`[THROTTLE] Request ${key} throttled: ${request.count} requests in ${timeWindow}ms`);
      return true;
    }
    
    // Reset counter if it's been more than 3 seconds
    if (timeWindow > 3000) {
      this.requests[key] = {
        count: 1,
        lastTime: now
      };
    } else {
      // Otherwise just increment the counter
      this.requests[key] = {
        count: request.count + 1,
        lastTime: now
      };
    }
    return false;
  },
  
  // Add method to clear stale trackers
  cleanup() {
    const now = Date.now();
    Object.keys(this.requests).forEach(key => {
      if (now - this.requests[key].lastTime > 60000) { // Remove after 1 minute of inactivity
        delete this.requests[key];
      }
    });
  }
};

// Run cleanup periodically
setInterval(() => requestTracker.cleanup(), 60000);

const loadInitialMessages = async (io, socket, data) => {
  try {
    const { id, channel, type, limit = 50 } = data;
    
    const requestKey = `${socket.id}:${type}:${id || channel}`;
    if (requestTracker.isThrottled(requestKey)) {
      console.warn(`[THROTTLE] Too many requests for ${requestKey}`);
      socket.emit('loadInitialMessages', {
        error: 'Too many requests. Please wait a few seconds.',
        throttled: true,
        messages: [], // Add empty messages array to avoid frontend errors
        type: type,
        conversationId: id,
        channel: channel
      });
      return;
    }
    
    console.log(`[LOAD] Loading initial messages:`, {
      id, channel, type, limit,
      user: socket.user.username
    });
    
    let conversationId = id || channel;
    
    if (!conversationId) {
      console.error('[LOAD] Missing conversationId in loadInitialMessages');
      socket.emit('loadInitialMessages', { error: 'Channel or conversation ID is required' });
      return;
    }
    
    if (type === 'channel') {
      const roomName = `channel_${conversationId.toString().toLowerCase()}`;
      const rooms = Array.from(socket.rooms || []);
      const alreadyInRoom = rooms.includes(roomName);
      
      if (!alreadyInRoom) {
        console.log(`[LOAD] Joining user ${socket.user.username} to channel room: ${roomName}`);
        socket.join(roomName);
      }
    }
    
    if (type === 'channel') {
      const channelName = conversationId.toLowerCase();
      console.log(`[LOAD] Loading messages for channel: ${channelName}`);
      
      try {
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
        
        const transformedMessages = messages.map(transformMessage).reverse();
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
    } else if (type === 'direct') {
      try {
        try {
          const originalId = conversationId;
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
            const participants = conversation.participants;
            if (!participants || participants.length !== 2) {
              throw new Error('Invalid direct conversation participants');
            }
            
            try {
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
    await User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: new Date()
    });
    
    socket.join(socket.user._id.toString());
    console.log(`[CONNECTION] User ${socket.user.username} joined personal room ${socket.user._id}`);
    
    const user = await User.findById(socket.user._id).populate('conversations.conversationId');
    
    for (const conv of user.conversations) {
      if (conv.conversationId && conv.conversationId.type === 'direct') {
        const conversationId = conv.conversationId._id.toString();
        socket.join(conversationId);
        console.log(`[CONNECTION] User ${socket.user.username} joined conversation room ${conversationId}`);
        
        const otherParticipant = conv.conversationId.participants.find(
          p => p.toString() !== socket.user._id.toString()
        );
        
        if (otherParticipant) {
          const sortedIds = [socket.user._id.toString(), otherParticipant.toString()].sort();
          const conversationRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
          socket.join(conversationRoomId);
          console.log(`[CONNECTION] User ${socket.user.username} joined unified room ${conversationRoomId}`);
        }
      }
    }
    
    socket.broadcast.emit('userConnected', {
      userId: socket.user._id,
      username: socket.user.username,
      status: 'online'
    });
    
    const onlineUsers = Array.from(connectedUsers.keys()).map(userId => ({
      userId,
      username: connectedUsers.get(userId).username,
      status: 'online'
    }));
    
    socket.emit('onlineUsers', onlineUsers);
    
    // Add handlers for dynamic room joining
    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`[JOIN] User ${socket.user.username} joined room ${room}`);
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
      console.log(`[LEAVE] User ${socket.user.username} left room ${room}`);
    });
    
    return true;
  } catch (error) {
    console.error('[CONNECTION] Error handling connection:', error);
    return false;
  }
};

const handleDisconnect = async (io, socket, connectedUsers) => {
  try {
    const userId = socket.user._id.toString();
    
    connectedUsers.delete(userId);
    
    await User.findByIdAndUpdate(userId, { 
      status: 'offline',
      lastSeen: new Date()
    });
    
    io.emit('userDisconnected', { 
      userId,
      username: socket.user.username,
      status: 'offline'
    });
    
    console.log(`[DISCONNECT] User disconnected: ${socket.user.username} (${userId})`);
  } catch (error) {
    console.error('[DISCONNECT] Error handling disconnect:', error);
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
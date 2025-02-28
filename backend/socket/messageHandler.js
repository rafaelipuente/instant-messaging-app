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

// Unified function to broadcast messages
const broadcastMessage = (io, roomIds, message, type) => {
  const transformedMessage = transformMessage(message);
  
  // Ensure roomIds is an array
  const rooms = Array.isArray(roomIds) ? roomIds : [roomIds];
  
  // Send to all specified rooms
  rooms.forEach(roomId => {
    if (!roomId) return;
    
    // Use the unified messageReceived event
    io.to(roomId.toString()).emit('messageReceived', {
      type,
      message: transformedMessage
    });
    
    // Also send the specific event type for backward compatibility
    const eventName = type === 'channel' ? 'channelMessage' : 'directMessage';
    io.to(roomId.toString()).emit(eventName, transformedMessage);
  });
  
  return transformedMessage;
};

const handleChannelMessage = async (io, socket, data) => {
  try {
    const { content, channel } = data;
    
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

    // Broadcast message to everyone in the channel
    return broadcastMessage(io, channelName, message, 'channel');
  } catch (error) {
    console.error('[CHANNEL] Error handling channel message:', error);
    console.error('[CHANNEL] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to send channel message' });
    throw error;
  }
};

const handleDirectMessage = async (io, socket, data) => {
  try {
    const { content, receiverId } = data;
    const senderId = socket.user._id;

    console.log(`[DIRECT MESSAGE] Handling direct message from ${socket.user.username} to ${receiverId}`);

    // Find or create the conversation between the users
    const conversation = await Conversation.findOrCreateDirectConversation(senderId, receiverId);
    
    // Create and save the message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content
    });

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

    // Broadcast to both users
    return broadcastMessage(io, [senderId.toString(), receiverId.toString()], message, 'direct');
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

const loadInitialMessages = async (socket, data) => {
  try {
    const { channel, type, limit = 50 } = data;
    
    console.log(`[LOAD] Loading initial messages: ${JSON.stringify(data)}`);
    
    if (!channel) {
      console.error('[LOAD] Missing channel in loadInitialMessages');
      socket.emit('error', { message: 'Channel or conversation ID is required' });
      return;
    }
    
    // Handle standard public channels by name (like 'general', 'tech-talk', etc.)
    if (type === 'channel') {
      // Standard channel - use lowercase name
      const channelName = channel.toLowerCase();
      console.log(`[LOAD] Loading messages for channel: ${channelName}`);
      
      // Get channel messages
      const messages = await Message.find({
        channel: channelName,
        isDeleted: false
      })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .populate('sender', 'username profilePicture status')
        .lean();
      
      console.log(`[LOAD] Found ${messages.length} channel messages`);
      
      // Transform and send messages
      const transformedMessages = messages.map(transformMessage);
      socket.emit('initialMessages', {
        channel,
        messages: transformedMessages
      });
      
      return transformedMessages;
    } else if (type === 'direct') {
      // It's a direct message conversation
      try {
        // Validate if the ID is a valid ObjectId (for DB lookup)
        let conversationId;
        try {
          conversationId = new mongoose.Types.ObjectId(channel);
        } catch (err) {
          console.error(`[LOAD] Invalid ObjectId format for direct message: ${channel}`);
          socket.emit('error', { message: 'Invalid conversation ID format' });
          return;
        }
        
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          console.error(`[LOAD] Conversation not found: ${channel}`);
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        if (conversation.type === 'direct') {
          // Get the participants
          const participants = conversation.participants;
          if (!participants || participants.length !== 2) {
            throw new Error('Invalid direct conversation participants');
          }
          
          // Load direct messages
          const messages = await Message.getDirectMessages(
            participants[0],
            participants[1],
            Number(limit)
          );
          
          console.log(`[LOAD] Found ${messages.length} direct messages`);
          
          // Transform and send messages
          const transformedMessages = messages.map(transformMessage);
          socket.emit('initialMessages', {
            channel,
            messages: transformedMessages
          });
          
          return transformedMessages;
        } else {
          console.error(`[LOAD] Found conversation but it's not a direct type: ${conversation.type}`);
          socket.emit('error', { message: 'Invalid conversation type' });
          return;
        }
      } catch (error) {
        console.error('[LOAD] Error processing conversation ID:', error);
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
    
    // Join rooms for all direct message conversations
    for (const conv of user.conversations) {
      if (conv.conversationId && conv.conversationId.type === 'direct') {
        socket.join(conv.conversationId._id.toString());
        console.log(`[CONNECTION] User ${socket.user.username} joined conversation ${conv.conversationId._id}`);
      }
    }
    
    // Notify others that user is online
    socket.broadcast.emit('userStatus', {
      userId: socket.user._id,
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
    
    console.log('User disconnected:', socket.user.username);
  } catch (error) {
    console.error('Error handling disconnect:', error);
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

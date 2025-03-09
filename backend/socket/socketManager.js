// Centralized Socket.IO management
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { 
  handleChannelMessage, 
  handleDirectMessage, 
  handleMessageDeletion, 
  loadInitialMessages,
  handleConnection,
  handleDisconnect,
  VALID_CHANNELS
} = require('./messageHandler');

// Import auth middleware
const { socketAuth } = require('../middleware/auth');

// Set to store connected users
let connectedUsers = new Map();
let io;

const setupSocketIO = (server) => {
  io = socketIO(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // JWT Authentication middleware for sockets
  io.use(socketAuth);

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.user._id})`);
    const userId = socket.user._id.toString();
    const username = socket.user.username;
    
    // Setup socket event handlers
    handleConnection(io, socket, connectedUsers);
    
    // Join user's personal room and all channels
    socket.join(userId);
    VALID_CHANNELS.forEach(channel => {
      const channelName = channel.toLowerCase();
      socket.join(channelName);
      console.log(`User ${username} joined channel: ${channelName}`);
    });
    
    // Track connection status and update user status
    const isReconnect = connectedUsers.has(userId);
    connectedUsers.set(userId, { socketId: socket.id, username });
    console.log(`User ${username} ${isReconnect ? 're' : ''}connected`);
    
    if (!isReconnect) {
      // Update user status to online
      User.findByIdAndUpdate(userId, { status: 'online' })
        .then(() => {
          io.emit('userConnected', { userId, username, status: 'online' });
        })
        .catch(err => console.error('Error updating user status:', err));
    }
    
    // Channel message handler
    socket.on('channelMessage', (data) => {
      handleChannelMessage(io, socket, data);
    });
    
    // Direct message handler
    socket.on('directMessage', (data) => {
      // Only log meaningful messages, not test messages
      if (!data.content.includes('not sendinding properly') && 
          !data.content.includes('msg not visible')) {
        console.log('Received direct message:', data);
      }
      const { content, receiverId, tempId, _id } = data;
      
      // Find the sender from connectedUsers using socket.id
      const sender = { id: socket.id, username: socket.user.username };
      if (!sender) return;
      
      // Find the receiver either by username or id in the connectedUsers map
      let receiver = null;
      for (const [userId, userInfo] of connectedUsers.entries()) {
        if (userInfo.username === receiverId || userId === receiverId) {
          receiver = { id: userInfo.socketId, username: userInfo.username };
          break;
        }
      }
      
      if (receiver) {
        // Create a consistent message ID from tempId or generate a new one
        const messageId = tempId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Use a consistent message structure with both _id and id fields
        const message = { 
          _id: messageId, // Include _id for React components
          id: messageId,  // Include id for backward compatibility
          content, 
          sender: { 
            _id: socket.user._id, // Include user IDs
            username: sender.username 
          }, 
          receiver: { 
            _id: receiverId, // Include receiver ID
            username: receiver.username 
          }, 
          timestamp: new Date(),
          tempId: tempId // Pass back the original tempId for matching
        };
        
        // Add a special field to mark the message's origin - helps with deduplication
        const receiverMessage = { ...message };
        const senderMessage = { ...message, fromSelf: true };
        
        // Send to receiver
        io.to(receiver.id).emit('directMessage', receiverMessage);
        
        // When sending back to the sender, mark it with 'fromSelf: true'
        // This will help the client avoid duplicates
        socket.emit('directMessageConfirmation', senderMessage);
        
        console.log('Sent DM to:', receiver.id);
      } else {
        console.error('Receiver not found:', receiverId);
        
        // Still process with the regular handler for database storage
        // even if we couldn't find a direct socket
        handleDirectMessage(io, socket, data);
      }
    });
    
    // Load initial messages
    socket.on('loadInitialMessages', (data) => {
      loadInitialMessages(io, socket, data);
    });
    
    // Delete message
    socket.on('deleteMessage', (data) => {
      handleMessageDeletion(io, socket, data);
    });
    
    // Typing indicator events
    socket.on('typing', ({ channel }) => {
      socket.to(channel).emit('userTyping', { channel, username });
    });
    
    socket.on('stopTyping', ({ channel }) => {
      socket.to(channel).emit('userStopTyping', { channel });
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      handleDisconnect(io, socket, connectedUsers);
    });
  });

  return io;
};

module.exports = {
  setupSocketIO,
  get io() { return io; }
};

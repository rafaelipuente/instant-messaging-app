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
      handleDirectMessage(io, socket, data);
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

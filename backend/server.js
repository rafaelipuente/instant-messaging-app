const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

// Import handlers from message handler
const { 
  handleDirectMessage,
  handleChannelMessage,
  handleMessageDeletion,
  loadInitialMessages,
  handleConnection,
  handleDisconnect,
  VALID_CHANNELS
} = require('./socket/messageHandler');

// Import models
const { Message } = require('./models/messageModel');

// Import authentication middleware
const { socketAuth } = require('./middleware/auth');

require('dotenv').config();

const app = require('./app');
const User = require('./models/userModel');

// Global error handlers for stability
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', error);
  console.error(error.name, error.message, error.stack);
  // Keep the process alive but log the error
});

process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION!', error);
  console.error(error.name, error.message, error.stack);
  // Keep the process alive but log the error
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io middleware for authentication
io.use(socketAuth);

// Track connected users
const connectedUsers = new Map();

// Socket.io connection handling
io.on('connection', async (socket) => {
  try {
    const userId = socket.user._id.toString();
    const username = socket.user.username;
    
    // Join user's personal room and all valid channels at once
    socket.join(userId);
    VALID_CHANNELS.forEach(channel => {
      const channelName = channel.toLowerCase();
      socket.join(channelName);
      console.log(`User ${username} joined channel: ${channelName}`);
    });
    
    // Track connection status
    const isReconnect = connectedUsers.has(userId);
    connectedUsers.set(userId, { socketId: socket.id, username });
    
    console.log(`User ${username} ${isReconnect ? 're' : ''}connected`);
    
    if (!isReconnect) {
      // Handle initial connection
      await handleConnection(io, socket, connectedUsers);
      
      // Update user status to online
      await User.findByIdAndUpdate(userId, { status: 'online' });
      io.emit('userConnected', { userId, username, status: 'online' });
    }
    
    // Register message event handlers
    socket.on('channelMessage', data => handleChannelMessage(io, socket, data));
    socket.on('directMessage', data => handleDirectMessage(io, socket, data));
    socket.on('deleteMessage', data => handleMessageDeletion(io, socket, data));
    socket.on('loadInitialMessages', data => loadInitialMessages(io, socket, data));
    
    // Typing indicator events
    socket.on('typing', ({ channel }) => {
      socket.to(channel).emit('userTyping', { channel, username });
    });
    
    socket.on('stopTyping', ({ channel }) => {
      socket.to(channel).emit('userStopTyping', { channel });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => handleDisconnect(io, socket, connectedUsers));
  } catch (error) {
    console.error('Socket connection error:', error);
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Server shutting down...');
  // Close database connection
  await mongoose.connection.close();
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

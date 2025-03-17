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
    
    const handleSocketEvents = (io, socket) => {
      console.log(`User connected: ${socket.user.username}`);
      
      // Join user to their personal room for direct messaging
      socket.join(socket.user._id.toString());
      console.log(`[CONNECTION] User ${socket.user.username} joined personal room ${socket.user._id.toString()}`);
      
      // Standard events
      socket.on('join_room', (room) => {
        if (!room) {
          console.error(`[JOIN] Invalid room name: ${room}`);
          return;
        }
        socket.join(room);
        console.log(`[JOIN] User ${socket.user.username} joined room ${room}`);
      });
      
      socket.on('leave_room', (room) => {
        if (!room) {
          console.error(`[LEAVE] Invalid room name: ${room}`);
          return;
        }
        socket.leave(room);
        console.log(`[LEAVE] User ${socket.user.username} left room ${room}`);
      });
      
      // Debug helper to check which rooms this socket is in
      socket.on('getRooms', () => {
        const socketRooms = Array.from(socket.rooms.values());
        console.log(`[ROOMS] User ${socket.user.username} is in rooms:`, socketRooms);
        socket.emit('roomsList', { rooms: socketRooms });
      });
      
      // Direct messaging
      socket.on('directMessage', async (data) => {
        try {
          console.log('Received direct message:', data);
          
          // Validate required fields
          if (!data.content || !data.receiverId) {
            socket.emit('messageError', { error: 'Missing required fields for direct message' });
            return;
          }
          
          // Add sender information to the data
          data.senderId = socket.user._id;
          data.senderUsername = socket.user.username;
          
          // Broadcast message to interested parties
          const message = await handleDirectMessage(io, socket, data);
          
          // If the message was successfully processed, confirm to the sender
          if (message) {
            socket.emit('directMessageConfirmation', { 
              success: true, 
              messageId: message._id,
              tempId: data.tempId,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('[DIRECT MESSAGE] Error processing message:', error);
          socket.emit('messageError', { 
            error: 'Failed to process direct message', 
            tempId: data.tempId,
            details: error.message 
          });
        }
      });
      
      // Chat room messaging
      socket.on('channelMessage', async (data) => {
        try {
          console.log(`Channel message from ${socket.user.username}`, data);
          const message = await handleChannelMessage(io, socket, data);
          
          if (message) {
            socket.emit('messageConfirmation', { 
              success: true, 
              messageId: message._id, 
              tempId: data.tempId,
              channel: data.channel,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`Error handling channel message: ${error.message}`);
          socket.emit('messageError', { 
            error: 'Failed to send channel message', 
            channel: data.channel,
            tempId: data.tempId
          });
        }
      });
      
      // Message loading
      socket.on('loadInitialMessages', async (data) => {
        try {
          await loadInitialMessages(io, socket, data);
        } catch (error) {
          console.error(`Error loading initial messages: ${error.message}`);
          socket.emit('loadInitialMessages', { 
            error: 'Failed to load messages',
            details: error.message
          });
        }
      });
      
      // Other events
      socket.on('typing', (data) => {
        if (!data || !data.room) return;
        socket.to(data.room).emit('typing', {
          username: socket.user.username,
          userId: socket.user._id
        });
      });
      
      socket.on('stopTyping', (data) => {
        if (!data || !data.room) return;
        socket.to(data.room).emit('stopTyping', {
          username: socket.user.username,
          userId: socket.user._id
        });
      });
      
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.username}`);
      });
    };
    
    handleSocketEvents(io, socket);
    
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

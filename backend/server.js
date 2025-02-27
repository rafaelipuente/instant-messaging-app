const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const { 
  handleDirectMessage, 
  handleChannelMessage, 
  loadInitialMessages, 
  handleConnection,
  handleMessageDeletion 
} = require('./socket/messageHandler');
const Message = require('./models/messageModel');

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
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// Track connected users
const connectedUsers = new Map();

// Socket.io connection handling
io.on('connection', async (socket) => {
  try {
    const userId = socket.user._id.toString();
    
    // Check if user is already connected
    if (connectedUsers.has(userId)) {
      // Update the socket ID for the user
      connectedUsers.get(userId).socketId = socket.id;
      console.log('User reconnected:', socket.user.username);
    } else {
      // Add new user connection
      connectedUsers.set(userId, { 
        socketId: socket.id,
        username: socket.user.username
      });
      console.log('User connected:', socket.user.username);

      // Handle initial connection setup
      await handleConnection(io, socket);

      // Update user status to online
      await User.findByIdAndUpdate(userId, { status: 'online' });
      io.emit('userConnected', { 
        userId: userId,
        username: socket.user.username,
        status: 'online'
      });
    }

    // Handle loading initial messages
    socket.on('loadInitialMessages', async (data) => {
      try {
        await loadInitialMessages(socket, data);
      } catch (error) {
        console.error('Error loading messages:', error);
        socket.emit('messageError', { error: 'Failed to load messages' });
      }
    });

    // Handle joining channels
    socket.on('join', async ({ channel }) => {
      try {
        const channelName = channel.toLowerCase();
        
        // Validate channel
        const validChannels = ['general', 'tech-talk', 'random', 'music'];
        if (!validChannels.includes(channelName)) {
          console.warn(`Invalid channel: ${channelName}`);
          socket.emit('error', { message: 'Invalid channel' });
          return;
        }
        
        console.log(`User ${socket.user.username} joining channel: ${channelName}`);
        socket.join(channelName);
        
        // Notify channel about new user
        socket.to(channelName).emit('userJoinedChannel', {
          username: socket.user.username,
          channel: channelName
        });
      } catch (error) {
        console.error('Error joining channel:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });
    
    // Handle joining rooms (for public chat rooms)
    socket.on('join room', (room) => {
      try {
        if (!room) {
          console.warn(`[JOIN ROOM] Invalid room name: ${room}`);
          socket.emit('error', { message: 'Invalid room name' });
          return;
        }
        
        // Validate room name
        const validRooms = ['general', 'tech-talk', 'random', 'music'];
        if (!validRooms.includes(room.toLowerCase())) {
          console.warn(`[JOIN ROOM] User ${socket.user.username} attempted to join invalid room: ${room}`);
          socket.emit('error', { message: 'Invalid room name' });
          return;
        }
        
        // Join the room
        socket.join(room);
        console.log(`[JOIN ROOM] User ${socket.user.username} joined room: ${room}`);
        
        // Notify other users in the room
        socket.to(room).emit('user joined', {
          username: socket.user.username,
          userId: socket.user._id,
          room: room
        });
      } catch (error) {
        console.error('[JOIN ROOM] Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    // Handle chat messages for rooms
    socket.on('chat message', async (msg) => {
      try {
        console.log(`[CHAT MESSAGE] User ${socket.user.username} sent message to room: ${msg.room}`);
        
        // Broadcast message to room
        io.to(msg.room).emit('chat message', {
          ...msg,
          sender: {
            _id: socket.user._id,
            username: socket.user.username
          },
          timestamp: new Date()
        });
        
        // Save message to database
        const message = new Message({ 
          content: msg.content, 
          room: msg.room,
          sender: socket.user._id,
          messageType: 'channel',
          channel: msg.room
        });
        
        await message.save();
        console.log(`[CHAT MESSAGE] Message saved to room: ${msg.room}`);
      } catch (error) {
        console.error('[CHAT MESSAGE] Error saving message:', error);
        socket.emit('error', { message: 'Failed to save message' });
      }
    });

    // Handle direct messages
    socket.on('directMessage', (data) => handleDirectMessage(io, socket, data));

    // Handle channel messages
    socket.on('channelMessage', (data) => handleChannelMessage(io, socket, data));

    // Handle message deletion
    socket.on('deleteMessage', (data) => handleMessageDeletion(io, socket, data));

    // Handle user typing
    socket.on('typing', ({ channel, username }) => {
      socket.to(channel.toLowerCase()).emit('userTyping', { username });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        const userId = socket.user._id.toString();
        
        // Check if user has other active connections
        if (connectedUsers.has(userId) && connectedUsers.get(userId).socketId === socket.id) {
          // Only remove user if this was their last connection
          connectedUsers.delete(userId);
          console.log('User fully disconnected:', socket.user.username);
          
          // Update user status to offline
          await User.findByIdAndUpdate(userId, { 
            status: 'offline', 
            lastSeen: new Date() 
          });
          io.emit('userDisconnected', { userId: userId });
        } else {
          console.log('User still has other active connections:', socket.user.username);
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });
  } catch (error) {
    console.error('Error handling socket connection:', error);
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

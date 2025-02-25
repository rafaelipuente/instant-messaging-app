const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const { handleDirectMessage, handleChannelMessage } = require('./socket/messageHandler');
const Message = require('./models/messageModel');

require('dotenv').config();

const app = require('./app');
const User = require('./models/userModel');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
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

// Socket.io connection handling
io.on('connection', async (socket) => {
  try {
    console.log('User connected:', socket.user.username);

    // Join user's personal room for direct messages
    socket.join(socket.user._id.toString());

    // Update user status to online
    await User.findByIdAndUpdate(socket.user._id, { status: 'online' });
    io.emit('userConnected', { userId: socket.user._id });

    // Handle joining channels
    socket.on('join', async ({ channel }) => {
      try {
        // Leave previous channel if any
        if (socket.currentChannel) {
          socket.leave(socket.currentChannel);
        }
        
        // Join new channel
        socket.join(channel.toLowerCase());
        socket.currentChannel = channel.toLowerCase();

        // Get previous messages for the channel
        const messages = await Message.find({
          channel: channel.toLowerCase(),
          messageType: 'channel'
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('sender', 'username profilePicture')
        .lean();

        // Send previous messages to the user
        socket.emit('previousMessages', messages.reverse());
      } catch (error) {
        console.error('Error joining channel:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Handle direct messages
    socket.on('directMessage', (data) => handleDirectMessage(io, socket, data));

    // Handle channel messages
    socket.on('channelMessage', (data) => handleChannelMessage(io, socket, data));

    // Handle user typing
    socket.on('typing', ({ channel, username }) => {
      socket.to(channel.toLowerCase()).emit('userTyping', { username });
    });

    socket.on('stopTyping', ({ channel }) => {
      socket.to(channel.toLowerCase()).emit('userStopTyping');
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.user.username);
      
      // Leave all channels
      if (socket.currentChannel) {
        socket.leave(socket.currentChannel);
      }
      
      // Update user status to offline
      await User.findByIdAndUpdate(socket.user._id, { 
        status: 'offline',
        lastSeen: new Date()
      });
      
      io.emit('userDisconnected', { userId: socket.user._id });
    });

  } catch (error) {
    console.error('Error in socket connection:', error);
  }
});

const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

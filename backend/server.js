const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const chatRoomRoutes = require('./routes/chatRoomRoutes');
const directMessageRoutes = require('./routes/directMessageRoutes');
const messageRoutes = require('./routes/messageRoutes');
const Message = require('./models/messageModel');
const User = require('./models/userModel');
const DirectMessage = require('./models/directMessageModel');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.headers.authorization) {
    console.log('Auth header present:', req.headers.authorization.substring(0, 20) + '...');
  }
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoomRoutes);
app.use('/api/dm', directMessageRoutes);
app.use('/api/messages', messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  res.status(err.status || 500).json({ 
    error: err.message || 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  let currentUser = null;
  let currentRoom = null;

  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUser = await User.findById(decoded._id);
      console.log('Socket authenticated for user:', currentUser.username);
    } catch (error) {
      console.error('Socket authentication error:', error);
    }
  });

  // Join a chat room
  socket.on('join', async ({ userId, channel }) => {
    try {
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
      }

      currentUser = await User.findById(userId);
      currentRoom = channel;
      socket.join(channel);
      console.log(`User ${currentUser.username} joined channel ${channel}`);

      // Fetch last 50 messages for the channel
      const messages = await Message.find({ channel })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('sender', 'username name')
        .lean();

      socket.emit('previousMessages', messages.reverse());
    } catch (error) {
      console.error('Error joining channel:', error);
    }
  });

  // Handle chat room messages
  socket.on('message', async (data) => {
    try {
      const { content, channel } = data;

      if (!currentUser || !channel) {
        console.error('Missing user or channel');
        return;
      }

      // Create and save new message
      const message = new Message({
        content,
        sender: currentUser._id,
        channel,
        timestamp: new Date()
      });

      await message.save();

      // Populate sender info and broadcast to channel
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username name')
        .lean();

      io.to(channel).emit('message', populatedMessage);
      console.log(`Message sent to channel ${channel} by ${currentUser.username}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });

  // Join user's personal room for direct messages
  socket.on('join user room', ({ userId }) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their personal room`);
  });

  // Join DM conversation room
  socket.on('join conversation', ({ conversationId }) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`User joined conversation ${conversationId}`);
  });

  // Handle typing events for both chat rooms and DMs
  socket.on('typing', ({ conversationId, channel, username }) => {
    if (conversationId) {
      console.log(`${username} is typing in conversation ${conversationId}`);
      socket.to(`conversation-${conversationId}`).emit('userTyping', { username });
    }
    if (channel) {
      console.log(`${username} is typing in channel ${channel}`);
      socket.to(channel).emit('userTyping', { username });
    }
  });

  socket.on('stopTyping', ({ conversationId, channel }) => {
    if (conversationId) {
      console.log(`User stopped typing in conversation ${conversationId}`);
      socket.to(`conversation-${conversationId}`).emit('userStopTyping');
    }
    if (channel) {
      console.log(`User stopped typing in channel ${channel}`);
      socket.to(channel).emit('userStopTyping');
    }
  });

  // Handle new direct message
  socket.on('new message', async ({ conversationId, message }) => {
    try {
      const conversation = await DirectMessage.findById(conversationId)
        .populate('participants', '_id');
      
      if (!conversation) {
        console.error('Conversation not found:', conversationId);
        return;
      }

      // Emit the message to all participants in the conversation
      conversation.participants.forEach(participant => {
        io.to(`user-${participant._id}`).emit('receive message', {
          ...message,
          conversationId
        });
      });
      console.log(`Direct message sent in conversation ${conversationId}`);
    } catch (error) {
      console.error('Error handling new direct message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (currentRoom) {
      socket.leave(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
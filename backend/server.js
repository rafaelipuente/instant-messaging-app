const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const Message = require('./models/messageModel');
const User = require('./models/userModel');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  let currentUser = null;
  let currentRoom = null;

  // Join a channel
  socket.on('join', async ({ userId, channel }) => {
    try {
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
      }

      currentUser = await User.findById(userId);
      currentRoom = channel;
      socket.join(channel);

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

  // Handle new message
  socket.on('message', async (data) => {
    try {
      const { content, channel } = data;

      if (!currentUser || !channel) {
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
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });

  // Handle user typing
  socket.on('typing', ({ channel, username }) => {
    socket.to(channel).emit('userTyping', { username });
  });

  // Handle user stop typing
  socket.on('stopTyping', ({ channel }) => {
    socket.to(channel).emit('userStopTyping');
  });

  // Handle disconnection
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

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
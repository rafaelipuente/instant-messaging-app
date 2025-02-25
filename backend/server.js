require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

// Import Express app
const app = require('./app');

// Import Models
const User = require('./models/userModel');
const Message = require('./models/messageModel');
const DirectMessage = require('./models/directMessageModel');

// Create HTTP Server & Attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io Auth Middleware
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded._id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io Event Handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  // Add user to socket room
  if (socket.userId) {
    socket.join(socket.userId);
    io.emit('userConnected', socket.userId);
  }

  /**
   * JOIN A CHAT CHANNEL
   */
  socket.on('join', async ({ userId, channel }) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) return;

      socket.leaveAll(); // Leave all previous rooms
      socket.join(channel);
      console.log(`User ${socket.username} joined channel: ${channel}`);

      // Fetch last 50 messages
      const messages = await Message.find({ channel })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('sender', 'username name profilePicture status');
      
      socket.emit('previousMessages', messages.reverse());
    } catch (error) {
      console.error('Error in join:', error);
    }
  });

  /**
   * SEND A MESSAGE IN A CHANNEL
   */
  socket.on('message', async ({ content, channel }) => {
    try {
      const newMessage = await Message.create({
        content,
        sender: socket.userId,
        channel,
        timestamp: new Date(),
      });
      
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'username name profilePicture status');
      
      io.to(channel).emit('message', populatedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  /**
   * JOIN DIRECT MESSAGE ROOM
   */
  socket.on('joinDM', async ({ userId, otherUserId }) => {
    try {
      // Prevent joining self-chat room
      if (userId === otherUserId) {
        console.warn('Blocked attempt to join self-chat room:', userId);
        return;
      }

      const roomId = [userId, otherUserId].sort().join('-');
      socket.join(roomId);
      console.log(`User ${userId} joined DM room ${roomId}`);

      // Fetch existing messages
      const messages = await DirectMessage.find({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId }
        ]
      })
      .sort({ timestamp: 1 })
      .populate('sender', 'username name profilePicture status')
      .populate('receiver', 'username name profilePicture status');

      socket.emit('previousDMs', messages);
    } catch (error) {
      console.error('Error in joinDM:', error);
      socket.emit('error', { message: 'Failed to join DM room' });
    }
  });

  socket.on('directMessage', async ({ content, receiverId }) => {
    try {
      const newMessage = await DirectMessage.create({
        content,
        sender: socket.userId,
        receiver: receiverId,
        timestamp: new Date()
      });

      const populatedMessage = await DirectMessage.findById(newMessage._id)
        .populate('sender', 'username profilePicture')
        .populate('receiver', 'username profilePicture');

      // Send to both sender and receiver
      io.to(socket.userId).emit('newDirectMessage', populatedMessage);
      io.to(receiverId).emit('newDirectMessage', populatedMessage);

      // Update active chats for both users
      io.to(socket.userId).emit('updateActiveChats', receiverId);
      io.to(receiverId).emit('updateActiveChats', socket.userId);
    } catch (error) {
      console.error('Error in direct message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Socket event handlers
  socket.on('updateActiveChats', async ({ userId }) => {
    try {
      // Find the user to add to active chats
      const user = await User.findById(userId).select('username profilePicture');
      if (user) {
        io.to(socket.userId).emit('updateActiveChats', userId);
        io.to(userId).emit('updateActiveChats', socket.userId);
      }
    } catch (error) {
      console.error('Error updating active chats:', error);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log('User disconnected:', socket.userId);
      io.emit('userDisconnected', socket.userId);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

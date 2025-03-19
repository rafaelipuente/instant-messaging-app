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
    origin: ['http://localhost:3000', 'http://127.0.0.1:63498', 'http://127.0.0.1:60811'],
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
  console.log('User connected:', socket.username);

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

  /**
   * SEND A DIRECT MESSAGE
   */
  socket.on('directMessage', async ({ content, receiverId }) => {
    try {
      // Prevent self-messaging
      if (socket.userId === receiverId) {
        console.warn('Blocked attempt to self-message:', socket.userId);
        return;
      }

      const newMessage = await DirectMessage.create({
        content,
        sender: socket.userId,
        receiver: receiverId,
        timestamp: new Date()
      });

      const populatedMessage = await DirectMessage.findById(newMessage._id)
        .populate('sender', 'username name profilePicture status')
        .populate('receiver', 'username name profilePicture status');

      // Create unique room ID for the conversation
      const roomId = [socket.userId, receiverId].sort().join('-');
      io.to(roomId).emit('newDirectMessage', populatedMessage);

      console.log('Direct message saved:', populatedMessage._id);
    } catch (error) {
      console.error('Error in directMessage:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  /**
   * DELETE A MESSAGE
   */
  socket.on('deleteMessage', async ({ messageId }) => {
    try {
      // First check if it's a direct message
      let message = await DirectMessage.findById(messageId);
      let isDirect = true;
      
      // If not found, check if it's a channel message
      if (!message) {
        message = await Message.findById(messageId);
        isDirect = false;
      }

      // If message not found at all, stop
      if (!message) {
        console.log(`Message with ID ${messageId} not found`);
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Make sure the user is the sender
      if (message.sender.toString() !== socket.userId) {
        console.log(`User ${socket.userId} tried to delete message ${messageId} but is not the sender`);
        socket.emit('error', { message: 'Unauthorized: You can only delete your own messages' });
        return;
      }

      // Handle direct messages differently than channel messages
      if (isDirect) {
        // For direct messages, we need to notify both sender and receiver
        const roomId = [message.sender.toString(), message.receiver.toString()].sort().join('-');
        
        // We don't physically delete the message, just mark it as deleted
        message.isDeleted = true;
        message.content = 'This message has been deleted';
        await message.save();
        
        // Broadcast to the room that the message was deleted
        io.to(roomId).emit('messageDeleted', messageId);
        console.log(`Direct message ${messageId} marked as deleted and notified room ${roomId}`);
      } else {
        // For channel messages
        const channel = message.channel;
        
        // Mark as deleted rather than physically deleting
        message.isDeleted = true;
        message.content = 'This message has been deleted';
        await message.save();
        
        // Broadcast to the channel
        io.to(channel).emit('messageDeleted', messageId);
        console.log(`Channel message ${messageId} marked as deleted and notified channel ${channel}`);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  /**
   * DISCONNECT
   */
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.username);
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

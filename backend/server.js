/*****************************************************
 * server.js
 *****************************************************/
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// 1. CONNECT TO MONGODB
const connectDB = require('./config/db');
connectDB();

// 2. IMPORT EXPRESS APP (FROM app.js)
const app = require('./app');

// 3. IMPORT MODELS FOR SOCKET LOGIC (Optional but needed for your chat events)
const User = require('./models/userModel');
const Message = require('./models/messageModel');
const DirectMessage = require('./models/directMessageModel');

// 4. CREATE HTTP SERVER & ATTACH SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// 5. SOCKET.IO AUTH MIDDLEWARE
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

// 6. SOCKET.IO EVENT HANDLERS
io.on('connection', (socket) => {
  console.log('User connected:', socket.username);

  /**
   * JOIN A CHAT CHANNEL
   */
  socket.on('join', async ({ userId, channel }) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        console.error(`No user found for ID: ${socket.userId}. Join aborted.`);
        return;
      }

      // Leave previous rooms except your own socket.id
      Object.keys(socket.rooms).forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join the new channel
      socket.join(channel);
      console.log(`User ${socket.username} joined channel: ${channel}`);

      // Fetch last 50 messages, oldest first
      const messages = await Message.find({ channel })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('sender', 'username name profilePicture status')
        .sort({ timestamp: 1 });

      // Send previous messages
      socket.emit('previousMessages', messages);
    } catch (error) {
      console.error('Error in join:', error);
    }
  });

  /**
   * SEND A MESSAGE IN CHANNEL
   */
  socket.on('message', async (data) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        console.error(`No user found for ID: ${socket.userId}. Cannot send message.`);
        return;
      }

      // Create and save message
      const newMessage = new Message({
        content: data.content,
        sender: socket.userId,
        channel: data.channel,
        timestamp: new Date(),
      });
      await newMessage.save();

      // Populate sender details for broadcast
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'username name profilePicture status');

      // Broadcast to everyone in the channel
      io.to(data.channel).emit('message', populatedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  /**
   * TYPING INDICATORS
   */
  socket.on('typing', (data) => {
    socket.to(data.channel).emit('userTyping', {
      username: data.username,
    });
  });

  socket.on('stopTyping', (data) => {
    socket.to(data.channel).emit('userStopTyping');
  });

  /**
   * JOIN DIRECT MESSAGE ROOM
   */
  socket.on('joinDM', async ({ userId, otherUserId }) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        console.error(`No user found for ID: ${socket.userId}. joinDM aborted.`);
        return;
      }

      // Create a unique room for these two users
      const roomId = [userId, otherUserId].sort().join('-');
      socket.join(roomId);

      // Fetch last 50 direct messages
      const messages = await DirectMessage.find({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('sender', 'username name profilePicture status')
        .populate('receiver', 'username name profilePicture status')
        .sort({ timestamp: 1 });

      // Send previous DMs
      socket.emit('previousDMs', messages);
    } catch (error) {
      console.error('Error fetching DMs:', error);
    }
  });

  /**
   * SEND A DIRECT MESSAGE
   */
  socket.on('directMessage', async ({ content, receiverId }) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        console.error(`No user found for ID: ${socket.userId}. Cannot send DM.`);
        return;
      }

      // Create and save the DM
      const message = new DirectMessage({
        content,
        sender: socket.userId,
        receiver: receiverId,
        timestamp: new Date(),
      });
      await message.save();

      // Populate sender/receiver
      const populatedMessage = await DirectMessage.findById(message._id)
        .populate('sender', 'username name profilePicture status')
        .populate('receiver', 'username name profilePicture status');

      // Emit to both participants
      const roomId = [socket.userId, receiverId].sort().join('-');
      io.to(roomId).emit('newDirectMessage', populatedMessage);
    } catch (error) {
      console.error('Error saving direct message:', error);
    }
  });

  /**
   * DISCONNECT
   */
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.username);
  });
});

// 7. START THE SERVER
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 8. GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
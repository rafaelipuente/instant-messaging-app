const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const Message = require('./models/messageModel');
const User = require('./models/userModel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.url}`, req.body);
//   next();
// });

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('New client connected');

  socket.on('join', async (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);

    // Send last 50 messages when joining a room
    try {
      const messages = await Message.find({ room })
        .populate('sender', 'username')
        .sort({ timestamp: -1 })
        .limit(50);
      
      socket.emit('previous-messages', messages.reverse());
    } catch (error) {
      console.error('Error fetching previous messages:', error);
    }
  });

  socket.on('message', async (data) => {
    try {
      // Find user by username
      const user = await User.findOne({ username: data.sender });
      if (!user) {
        console.error('User not found:', data.sender);
        return;
      }

      // Create and save message
      const message = new Message({
        content: data.content,
        room: data.room,
        sender: user._id,
        timestamp: new Date()
      });

      await message.save();
      await message.populate('sender', 'username');

      // Broadcast message to room
      io.to(data.room).emit('message', {
        _id: message._id,
        content: message.content,
        room: message.room,
        sender: user.username,
        timestamp: message.timestamp
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
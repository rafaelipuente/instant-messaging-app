const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const chatRoomRoutes = require('./routes/chatRoomRoutes');
const Message = require('./models/messageModel'); // Message model for saving messages

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(express.json());
app.use(cors());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/chatrooms', chatRoomRoutes);

// WebSocket Logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room joining and load messages
    socket.on('joinRoom', async (room) => {
        console.log(`User ${socket.id} joined room: ${room}`);
        socket.join(room);

        try {
            // Fetch messages from the database for the room
            const messages = await Message.find({ room }).sort({ timestamp: 1 });
            socket.emit('loadMessages', messages); // Send previous messages to the client
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    });

    // Handle new messages
    socket.on('message', async (data) => {
        console.log(`Message received in room ${data.room}:`, data.message);

        try {
            // Save the message to the database
            const newMessage = new Message({
                room: data.room,
                user: data.user || 'Anonymous', // Use provided user data or default to 'Anonymous'
                message: data.message,
            });
            await newMessage.save();

            // Broadcast the message to the room
            io.to(data.room).emit('message', {
                user: data.user || 'Anonymous',
                message: data.message,
                timestamp: newMessage.timestamp, // Include timestamp
            });
            console.log(`Message broadcasted to room: ${data.room}`);
        } catch (error) {
            console.error('Error saving message to the database:', error);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

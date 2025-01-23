const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const chatRoomRoutes = require('./routes/chatRoomRoutes');
const Message = require('./models/messageModel'); // Add a message model for saving messages

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

    socket.on('joinRoom', (room) => {
        console.log(`joinRoom event triggered for user: ${socket.id}, room: ${room}`);
        socket.join(room);
        console.log(`User ${socket.id} successfully joined room: ${room}`);
    });

    socket.on('message', async (data) => {
        console.log(`message event triggered for room: ${data.room}, user: ${socket.id}`);
        console.log(`Message content: ${data.message}`);

        // Save message to the database
        try {
            const message = new Message({
                room: data.room,
                user: data.user || 'Anonymous', // User ID or name
                message: data.message,
            });
            await message.save();

            // Broadcast message to the room
            io.to(data.room).emit('message', { user: data.user || 'Anonymous', message: data.message });
            console.log(`Message broadcasted to room: ${data.room}`);
        } catch (error) {
            console.error('Error saving message to the database:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

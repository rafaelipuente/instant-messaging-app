// WebSocket Logic
io.on('connection', (socket) => {
    console.log(`User connected with ID: ${socket.id}`);

    // Handle room joining and load messages
    socket.on('joinRoom', async (room) => {
        console.log(`User ${socket.id} joining room: ${room}`);
        socket.join(room);

        try {
            // Fetch messages from the database for the room
            const messages = await Message.find({ room }).sort({ timestamp: 1 });
            socket.emit('loadMessages', messages); // Send previous messages to the client
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    });

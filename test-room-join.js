const io = require('socket.io-client');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Updated JWT token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2N2FiMGYxZDU1ZjU2YjhmMjBhNDk5OTYiLCJ1c2VybmFtZSI6InJhZmFhMTE3IiwiaWF0IjoxNzQwNjE1NTc0LCJleHAiOjE3NDEyMjAzNzR9.O1eP72xo98KgisoIVvY2WlTzafea7TsKiIIlfIEDpXw';

// Connect to the server
const socket = io('http://localhost:5001', {
  auth: { token },
  transports: ['websocket'],
  reconnection: true
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to server');
  
  // Ask which room to join
  rl.question('Enter room to join (general, tech-talk, random, music): ', (room) => {
    console.log(`Joining room: ${room}`);
    socket.emit('join room', room);
    
    // Listen for chat messages
    socket.on('chat message', (message) => {
      console.log(`[${message.room}] ${message.sender.username}: ${message.content}`);
    });
    
    // Listen for user joined events
    socket.on('user joined', (data) => {
      console.log(`User ${data.username} joined room ${data.room}`);
    });
    
    // Ask for message to send
    askForMessage(socket, room);
  });
});

function askForMessage(socket, room) {
  rl.question('Enter message (or "exit" to quit): ', (message) => {
    if (message.toLowerCase() === 'exit') {
      socket.disconnect();
      rl.close();
      return;
    }
    
    // Send message to room
    socket.emit('chat message', {
      content: message,
      room: room,
      timestamp: new Date()
    });
    
    // Ask for another message
    askForMessage(socket, room);
  });
}

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  rl.close();
});

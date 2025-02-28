// Centralized Socket.IO management
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { 
  handleChannelMessage, 
  handleDirectMessage, 
  handleMessageDeletion, 
  loadInitialMessages,
  handleConnection,
  handleDisconnect
} = require('./messageHandler');

// Import auth middleware
const { socketAuth } = require('../middleware/auth');

// Set to store connected users
let connectedUsers = new Map();
let io;

const setupSocketIO = (server) => {
  io = socketIO(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // JWT Authentication middleware for sockets
  io.use(socketAuth);

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.user._id})`);
    
    // Setup socket event handlers
    handleConnection(io, socket, connectedUsers);
    
    // Channel message handler
    socket.on('channelMessage', (data) => {
      handleChannelMessage(io, socket, data);
    });
    
    // Direct message handler
    socket.on('directMessage', (data) => {
      handleDirectMessage(io, socket, data);
    });
    
    // Load initial messages
    socket.on('loadInitialMessages', (data) => {
      loadInitialMessages(socket, data);
    });
    
    // Delete message
    socket.on('deleteMessage', (data) => {
      handleMessageDeletion(io, socket, data);
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      handleDisconnect(io, socket, connectedUsers);
    });
  });

  return io;
};

module.exports = {
  setupSocketIO,
  get io() { return io; }
};

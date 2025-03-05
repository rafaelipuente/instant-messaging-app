const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config();

const app = require('./app');
const { setupSocketIO } = require('./socket/socketManager');
const Conversation = require('./models/channelModel');
const User = require('./models/userModel');

// Global error handlers for stability
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', error);
  console.error(error.name, error.message, error.stack);
  // Keep the process alive but log the error
});

process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION!', error);
  console.error(error.name, error.message, error.stack);
  // Keep the process alive but log the error
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Create default channels if they don't exist
    return Conversation.findOrCreateDefaultChannels(new mongoose.Types.ObjectId())
      .then(channels => {
        console.log(`Default channels initialized: ${channels.map(c => c.name).join(', ')}`);
      })
      .catch(err => {
        console.error('Error creating default channels:', err);
        // Continue server startup even if channel creation fails
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const server = http.createServer(app);

// Setup Socket.IO using the centralized socket manager
const io = setupSocketIO(server);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Server shutting down...');
  // Close database connection
  await mongoose.connection.close();
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

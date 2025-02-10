const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Clear any existing connections
    await mongoose.disconnect();
    
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/chat-app');

    console.log('MongoDB Connected to:', conn.connection.host);
    console.log('Database:', conn.connection.name);

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
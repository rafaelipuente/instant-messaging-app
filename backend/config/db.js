const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Clear any existing connections
    await mongoose.disconnect();
    
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/chat-app');

    console.log('MongoDB Connected to:', conn.connection.host);
    console.log('Database:', conn.connection.name);

    // Drop existing collections to start fresh
    const collections = await conn.connection.db.collections();
    for (const collection of collections) {
      await collection.drop();
      console.log(`Dropped collection: ${collection.collectionName}`);
    }

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
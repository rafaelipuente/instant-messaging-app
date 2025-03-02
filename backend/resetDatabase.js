const mongoose = require('mongoose');
const { Message } = require('./models/messageModel');
const User = require('./models/userModel');
const Conversation = require('./models/channelModel');
require('dotenv').config();

async function resetDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop all collections
    console.log('Dropping collections...');
    
    const collections = [
      { name: 'Messages', model: Message },
      { name: 'Users', model: User },
      { name: 'Conversations/Channels', model: Conversation }
    ];

    for (const collection of collections) {
      try {
        console.log(`Clearing ${collection.name}...`);
        await collection.model.deleteMany({});
        console.log(`${collection.name} cleared successfully`);
      } catch (error) {
        console.error(`Error clearing ${collection.name}:`, error);
      }
    }

    console.log('Database reset complete');
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

// Run the reset function
resetDatabase();

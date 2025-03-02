const mongoose = require('mongoose');
const Conversation = require('./models/channelModel');
const { VALID_CHANNELS } = require('./models/messageModel');
require('dotenv').config();

async function setupDefaultChannels() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Setting up default channels...');
    
    // Create system user ID for channel creation
    const systemUserId = new mongoose.Types.ObjectId();
    
    // Create default channels
    for (const channelName of VALID_CHANNELS) {
      try {
        const exists = await Conversation.channelExists(channelName);
        
        if (!exists) {
          console.log(`Creating default channel: ${channelName}`);
          await Conversation.create({
            name: channelName.toLowerCase(),
            displayName: channelName.charAt(0).toUpperCase() + channelName.slice(1),
            type: 'channel',
            createdBy: systemUserId,
            isDefaultChannel: true
          });
          console.log(`Channel ${channelName} created successfully`);
        } else {
          console.log(`Channel ${channelName} already exists`);
        }
      } catch (error) {
        console.error(`Error creating channel ${channelName}:`, error);
      }
    }

    console.log('Default channels setup complete');
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up default channels:', error);
    process.exit(1);
  }
}

// Run the setup function
setupDefaultChannels();

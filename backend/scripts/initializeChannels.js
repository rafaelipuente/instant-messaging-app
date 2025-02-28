const mongoose = require('mongoose');
const Conversation = require('../models/channelModel');
const { VALID_CHANNELS } = require('../models/messageModel');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Default channels to create
const defaultChannels = [
  {
    name: 'general',
    displayName: 'General',
    description: 'General discussion for everyone',
    icon: '🌐'
  },
  {
    name: 'tech-talk',
    displayName: 'Tech Talk',
    description: 'Discussions about technology and programming',
    icon: '💻'
  },
  {
    name: 'random',
    displayName: 'Random',
    description: 'Random topics and casual conversation',
    icon: '🎲'
  },
  {
    name: 'music',
    displayName: 'Music',
    description: 'Share and discuss your favorite music',
    icon: '🎵'
  }
];

// Initialize channels
const initializeChannels = async () => {
  console.log('Initializing default channels...');
  
  try {
    // Find a default admin/system user, or create one if needed
    let systemUserId;
    
    try {
      // Try to find any user to be the creator
      const anyUser = await mongoose.model('User').findOne();
      if (anyUser) {
        systemUserId = anyUser._id;
      } else {
        // If no users exist, create a dummy system user ID
        systemUserId = new mongoose.Types.ObjectId();
      }
    } catch (error) {
      // If User model isn't available, create a dummy system user ID
      systemUserId = new mongoose.Types.ObjectId();
    }
    
    // Process each channel
    for (const channel of defaultChannels) {
      // Check if channel already exists
      const existingChannel = await Conversation.findOne({ 
        name: channel.name,
        type: 'channel'
      });
      
      if (existingChannel) {
        console.log(`Channel '${channel.name}' already exists, skipping...`);
        continue;
      }
      
      // Create new channel
      await Conversation.create({
        name: channel.name,
        displayName: channel.displayName,
        description: channel.description,
        icon: channel.icon,
        type: 'channel',
        createdBy: systemUserId,
        isDefaultChannel: true
      });
      
      console.log(`Created channel: ${channel.displayName}`);
    }
    
    console.log('Default channels initialized successfully!');
  } catch (error) {
    console.error('Error initializing channels:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Run the initialization
initializeChannels();

const mongoose = require('mongoose');
const Channel = require('../models/channelModel');
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
  try {
    // Check if channels already exist
    const existingChannels = await Channel.find({});
    
    if (existingChannels.length === 0) {
      console.log('No channels found. Creating default channels...');
      
      // Create default channels
      await Channel.insertMany(defaultChannels);
      console.log('Default channels created successfully!');
    } else {
      console.log(`${existingChannels.length} channels already exist. No action needed.`);
    }
    
    // Display all channels
    const allChannels = await Channel.find({}).lean();
    console.log('Current channels:');
    allChannels.forEach(channel => {
      console.log(`- ${channel.displayName} (${channel.name}): ${channel.description}`);
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error initializing channels:', error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Run the initialization
initializeChannels();

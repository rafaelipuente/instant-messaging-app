const mongoose = require('mongoose');
const { VALID_CHANNELS } = require('./messageModel');

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['channel', 'direct'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '💬'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // This field is only used for predefined channels 
  // like "general", "tech-talk", etc.
  isDefaultChannel: {
    type: Boolean,
    default: false
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ type: 1, isDefaultChannel: 1 });

// Static method to find or create a direct conversation between two users
conversationSchema.statics.findOrCreateDirectConversation = async function(userId1, userId2) {
  // Create a consistent ID for the conversation
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  const name = `dm_${sortedIds[0]}_${sortedIds[1]}`;
  
  // Try to find an existing conversation
  let conversation = await this.findOne({ 
    name,
    type: 'direct'
  });
  
  // If not found, create a new one
  if (!conversation) {
    conversation = await this.create({
      name,
      displayName: `Direct Message`,
      type: 'direct',
      createdBy: userId1,
      participants: [userId1, userId2]
    });
  }
  
  return conversation;
};

// Static method to find or create default channels
conversationSchema.statics.findOrCreateDefaultChannels = async function(creatorId) {
  const defaultChannels = [];
  
  for (const channelName of VALID_CHANNELS) {
    let channel = await this.findOne({ name: channelName });
    
    if (!channel) {
      channel = await this.create({
        name: channelName,
        displayName: channelName.charAt(0).toUpperCase() + channelName.slice(1),
        type: 'channel',
        createdBy: creatorId,
        isDefaultChannel: true,
        participants: [creatorId]
      });
    }
    
    defaultChannels.push(channel);
  }
  
  return defaultChannels;
};

module.exports = mongoose.model('Conversation', conversationSchema);

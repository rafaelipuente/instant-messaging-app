const mongoose = require('mongoose');
const path = require('path');

// Constants for valid channels
const VALID_CHANNELS = ['general', 'tech-talk', 'random', 'music'];

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Optional receiver for direct messages
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  // Channel name for public messages, null for direct messages
  channel: {
    type: String,
    enum: [...VALID_CHANNELS, null],
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create appropriate compound indexes
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ channel: 1, timestamp: -1 });

// Helper to determine if message is direct or channel
messageSchema.virtual('messageType').get(function() {
  return this.channel ? 'channel' : 'direct';
});

// Static method to get channel messages
messageSchema.statics.getChannelMessages = async function(channel, limit = 50) {
  if (!VALID_CHANNELS.includes(channel)) {
    throw new Error('Invalid channel name');
  }
  
  return this.find({ 
    channel: channel,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username profilePicture status')
    .lean();
};

// Static method to get DM conversation
messageSchema.statics.getDirectMessages = async function(userId1, userId2, limit = 50) {
  return this.find({
    $or: [
      { sender: userId1, receiver: userId2, isDeleted: false },
      { sender: userId2, receiver: userId1, isDeleted: false }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username profilePicture status')
    .populate('receiver', 'username profilePicture status')
    .lean();
};

// Helper function to generate a consistent chat ID for two users
messageSchema.statics.generateChatId = function(userId1, userId2) {
  // Sort IDs to ensure consistency regardless of parameter order
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

// Transform message for client
messageSchema.methods.toClientJSON = function() {
  const sender = this.sender;
  const receiver = this.receiver;
  
  const response = {
    _id: this._id,
    content: this.content,
    timestamp: this.createdAt,
    isDeleted: this.isDeleted,
    sender: {
      _id: sender._id,
      username: sender.username,
      profilePicture: sender.profilePicture ? 
        `/uploads/${path.basename(sender.profilePicture)}` : null
    }
  };

  if (this.channel) {
    response.channel = this.channel;
  }

  if (receiver) {
    response.receiver = {
      _id: receiver._id,
      username: receiver.username,
      profilePicture: receiver.profilePicture ? 
        `/uploads/${path.basename(receiver.profilePicture)}` : null
    };
  }

  return response;
};

module.exports = {
  Message: mongoose.model('Message', messageSchema),
  VALID_CHANNELS
};

const mongoose = require('mongoose');
const path = require('path');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  // Can be either a chatId for DMs or a channel name for general chats
  channel: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['direct', 'channel'],
    required: true
  }
}, {
  timestamps: true
});

// Create compound indexes for efficient retrieval
messageSchema.index({ channel: 1, timestamp: -1 });
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });

// Virtual for populating user details
messageSchema.virtual('senderDetails', {
  ref: 'User',
  localField: 'sender',
  foreignField: '_id',
  justOne: true
});

messageSchema.virtual('receiverDetails', {
  ref: 'User',
  localField: 'receiver',
  foreignField: '_id',
  justOne: true
});

// Generate unique chat ID for two users
messageSchema.statics.generateChatId = function(userId1, userId2) {
  // Sort IDs to ensure consistency
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return `dm-${sortedIds[0]}-${sortedIds[1]}`;
};

// Transform message for client
messageSchema.methods.toClientJSON = function() {
  return {
    _id: this._id,
    content: this.content,
    timestamp: this.timestamp,
    messageType: this.messageType,
    channel: this.channel,
    sender: {
      _id: this.sender._id,
      username: this.sender.username,
      profilePicture: this.sender.profilePicture ? `/uploads/${path.basename(this.sender.profilePicture)}` : null
    },
    receiver: this.receiver ? {
      _id: this.receiver._id,
      username: this.receiver.username,
      profilePicture: this.receiver.profilePicture ? `/uploads/${path.basename(this.receiver.profilePicture)}` : null
    } : null
  };
};

module.exports = mongoose.model('Message', messageSchema);

const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],
  lastMessage: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure participants array always has exactly 2 users
directMessageSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    next(new Error('Direct messages must have exactly 2 participants'));
  }
  next();
});

// Create a compound index on participants to efficiently query conversations
directMessageSchema.index({ participants: 1 });

const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);

module.exports = DirectMessage;

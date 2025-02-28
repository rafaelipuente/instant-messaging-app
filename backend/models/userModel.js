const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline'
  },
  // Store direct conversations and channels in a single array
  conversations: [{
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    lastViewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Helper method to add a conversation to the user's list
userSchema.methods.addConversation = async function(conversationId) {
  if (!this.conversations.some(c => c.conversationId.equals(conversationId))) {
    this.conversations.push({
      conversationId,
      unreadCount: 0,
      lastViewedAt: new Date()
    });
    await this.save();
  }
  return this;
};

// Helper method to mark a conversation as read
userSchema.methods.markConversationAsRead = async function(conversationId) {
  const conv = this.conversations.find(c => c.conversationId.equals(conversationId));
  if (conv) {
    conv.unreadCount = 0;
    conv.lastViewedAt = new Date();
    await this.save();
  }
  return this;
};

// Helper method to increment unread count for a conversation
userSchema.methods.incrementUnreadCount = async function(conversationId) {
  const conv = this.conversations.find(c => c.conversationId.equals(conversationId));
  if (conv) {
    conv.unreadCount += 1;
    await this.save();
  }
  return this;
};

// Safely transform user object for client
userSchema.methods.toClientJSON = function() {
  return {
    _id: this._id,
    username: this.username,
    profilePicture: this.profilePicture,
    status: this.status,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt
  };
};

// Create indexes for querying
userSchema.index({ status: 1 });
userSchema.index({ 'conversations.conversationId': 1 });

module.exports = mongoose.model('User', userSchema);

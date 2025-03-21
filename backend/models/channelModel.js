const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Get messages for a specific channel
channelSchema.statics.getMessages = async function(channelId, limit = 50) {
  const Message = mongoose.model('Message');
  
  return await Message.find({ 
    channel: channelId,
    isDeleted: { $ne: true }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('sender', 'username name profilePicture')
  .lean();
};

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;

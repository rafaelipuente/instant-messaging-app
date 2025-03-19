const User = require('../models/userModel');
const Conversation = require('../models/channelModel');
const mongoose = require('mongoose');

/**
 * Get all conversations for the current user
 */
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find user with populated conversations
    const user = await User.findById(userId)
      .populate({
        path: 'conversations.conversationId',
        populate: {
          path: 'participants',
          select: 'username profilePicture status lastSeen'
        }
      });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Process each conversation to include additional info
    const processedConversations = await Promise.all(
      user.conversations.map(async (conv) => {
        const conversation = conv.conversationId;
        if (!conversation) return null; // Skip if conversation not found
        
        // Basic conversation info
        const result = {
          _id: conversation._id,
          name: conversation.name,
          displayName: conversation.displayName || conversation.name,
          type: conversation.type,
          unreadCount: conv.unreadCount || 0,
          lastViewedAt: conv.lastViewedAt,
          lastActivity: conversation.lastActivity
        };
        
        // For direct messages, include other user info
        if (conversation.type === 'direct' && conversation.participants) {
          const otherUser = conversation.participants.find(
            p => p._id.toString() !== userId.toString()
          );
          
          if (otherUser) {
            result.otherUser = {
              _id: otherUser._id,
              username: otherUser.username,
              profilePicture: otherUser.profilePicture,
              status: otherUser.status,
              lastSeen: otherUser.lastSeen
            };
            result.displayName = `Chat with ${otherUser.username}`;
          }
        }
        
        return result;
      })
    );
    
    // Filter out null values and sort by last activity
    const validConversations = processedConversations
      .filter(Boolean)
      .sort((a, b) => {
        return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
      });
    
    res.status(200).json({ 
      success: true, 
      conversations: validConversations 
    });
  } catch (error) {
    console.error('Error getting user conversations:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get a specific conversation by ID
 */
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
    }
    
    // Find the conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username profilePicture status lastSeen');
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      p => p._id.toString() === userId.toString()
    );
    
    if (!isParticipant && conversation.type !== 'channel') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this conversation' });
    }
    
    // Basic conversation info
    const result = {
      _id: conversation._id,
      name: conversation.name,
      displayName: conversation.displayName || conversation.name,
      type: conversation.type,
      lastActivity: conversation.lastActivity,
      participants: conversation.participants.map(p => ({
        _id: p._id,
        username: p.username,
        profilePicture: p.profilePicture,
        status: p.status,
        lastSeen: p.lastSeen
      }))
    };
    
    // For direct messages, include other user info
    if (conversation.type === 'direct') {
      const otherUser = conversation.participants.find(
        p => p._id.toString() !== userId.toString()
      );
      
      if (otherUser) {
        result.otherUser = {
          _id: otherUser._id,
          username: otherUser.username,
          profilePicture: otherUser.profilePicture,
          status: otherUser.status,
          lastSeen: otherUser.lastSeen
        };
        result.displayName = `Chat with ${otherUser.username}`;
      }
    }
    
    // Mark conversation as read
    await User.updateOne(
      { 
        _id: userId,
        'conversations.conversationId': conversationId 
      },
      { 
        $set: { 
          'conversations.$.lastViewedAt': new Date(),
          'conversations.$.unreadCount': 0
        } 
      }
    );
    
    res.status(200).json({ success: true, conversation: result });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

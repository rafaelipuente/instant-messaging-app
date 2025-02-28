const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Message } = require('../models/messageModel');
const User = require('../models/userModel');
const Conversation = require('../models/channelModel');
const mongoose = require('mongoose');

/**
 * DIRECT MESSAGE ROUTES
 * ---------------------
 * This file handles conversation management for direct messages.
 * 
 * Note: The main endpoints for retrieving conversations and sending messages 
 * are now consolidated in messageRoutes.js. This file focuses on conversation 
 * initialization and management features.
 */

/**
 * Helper: Validate user exists
 * @param {string} userId - User ID to validate
 * @returns {Object} User document if found
 * @throws {Error} If user not found
 */
const validateUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

/**
 * Start or get a direct message conversation
 * @route POST /api/direct/start
 * @auth Required
 * @body {string} otherUserId - The ID of the user to start conversation with
 * @returns {Object} Conversation details and initial message if created
 */
router.post('/start', auth, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user._id;

    if (userId === otherUserId) {
      return res.status(400).json({ message: "Cannot start chat with yourself" });
    }

    // Validate both users exist
    let currentUser, otherUser;
    try {
      currentUser = await validateUser(userId);
      otherUser = await validateUser(otherUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }

    // Check if conversation already exists
    let existingConversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, otherUserId] }
    })
    .populate({
      path: 'participants',
      select: 'username profilePicture status lastSeen'
    });

    if (existingConversation) {
      // Return existing conversation
      const otherUserDetails = existingConversation.participants.find(p => 
        p._id.toString() !== userId.toString()
      );
      
      return res.json({
        conversation: {
          _id: existingConversation._id,
          name: existingConversation.name,
          displayName: `Chat with ${otherUserDetails?.username || 'Unknown'}`,
          otherUser: otherUserDetails || null
        },
        isNew: false
      });
    }

    // Create new conversation
    const newConversation = new Conversation({
      name: `direct-${userId}-${otherUserId}`,
      type: 'direct',
      participants: [userId, otherUserId]
    });
    
    await newConversation.save();
    
    // Add conversation to both users
    await User.updateOne(
      { _id: userId },
      { $addToSet: { conversations: { conversationId: newConversation._id } } }
    );
    
    await User.updateOne(
      { _id: otherUserId },
      { $addToSet: { conversations: { conversationId: newConversation._id } } }
    );
    
    // Return newly created conversation
    return res.status(201).json({
      conversation: {
        _id: newConversation._id,
        name: newConversation.name,
        displayName: `Chat with ${otherUser.username}`,
        otherUser: {
          _id: otherUser._id,
          username: otherUser.username,
          profilePicture: otherUser.profilePicture,
          status: otherUser.status,
          lastSeen: otherUser.lastSeen
        }
      },
      isNew: true
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * Mark a conversation as read
 * @route POST /api/direct/mark-read
 * @auth Required
 * @body {string} conversationId - The ID of the conversation to mark as read
 * @returns {Object} Success message and updated unread count
 */
router.post('/mark-read', auth, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user._id;
    
    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }

    // Check if conversation exists
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Update the last viewed time and reset unread count
    const result = await User.updateOne(
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
    
    if (result.nModified === 0) {
      return res.status(400).json({ message: "Failed to update conversation" });
    }
    
    res.json({ message: "Conversation marked as read" });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * Send a message through REST API (alternative to socket)
 * Note: Primary message sending is handled through sockets
 * @route POST /api/direct/send
 * @auth Required
 * @body {string} receiverId - Recipient user ID
 * @body {string} content - Message content
 * @returns {Object} Created message
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user._id;
    
    if (!receiverId || !content || content.trim() === '') {
      return res.status(400).json({ message: "Recipient ID and content are required" });
    }
    
    // Find or create conversation
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [senderId, receiverId] }
    });
    
    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        name: `direct-${senderId}-${receiverId}`,
        type: 'direct',
        participants: [senderId, receiverId]
      });
      await conversation.save();
      
      // Add to both users' conversations
      await User.updateOne(
        { _id: senderId },
        { $addToSet: { conversations: { conversationId: conversation._id } } }
      );
      
      await User.updateOne(
        { _id: receiverId },
        { $addToSet: { conversations: { conversationId: conversation._id } } }
      );
    }
    
    // Create and save message
    const message = new Message({
      content,
      sender: senderId,
      receiver: receiverId,
      conversation: conversation._id,
      messageType: 'direct'
    });
    
    await message.save();
    
    // Increment unread count for receiver
    await User.updateOne(
      { 
        _id: receiverId,
        'conversations.conversationId': conversation._id 
      },
      { $inc: { 'conversations.$.unreadCount': 1 } }
    );
    
    // Return message with populated sender
    await message.populate('sender', 'username profilePicture status');
    
    res.status(201).json({
      message: {
        _id: message._id,
        content: message.content,
        sender: {
          _id: message.sender._id,
          username: message.sender.username,
          profilePicture: message.sender.profilePicture
        },
        createdAt: message.createdAt
      },
      conversation: conversation._id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
});

module.exports = router;

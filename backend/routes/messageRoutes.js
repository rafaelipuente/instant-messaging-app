const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const router = express.Router();
const auth = require('../middleware/auth');
const { Message, VALID_CHANNELS } = require('../models/messageModel');
const Conversation = require('../models/channelModel');
const User = require('../models/userModel');

/**
 * Get all messages for a channel
 * @route GET /api/messages/channel/:channelName
 * @auth Required
 * @param {string} channelName - Channel name
 * @returns {Array} Messages
 */
router.get('/channel/:channelName', auth, async (req, res) => {
  try {
    const { channelName } = req.params;
    const { limit = 50, before } = req.query;
    
    if (!VALID_CHANNELS.includes(channelName)) {
      return res.status(400).json({ error: 'Invalid channel name' });
    }
    
    let query = { 
      channel: channelName.toLowerCase(),
      isDeleted: false
    };
    
    // If before timestamp is provided, get messages before that time
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'username profilePicture status')
      .lean();
    
    // Format messages for client
    const formattedMessages = messages.map(msg => {
      const sender = msg.sender || { username: 'Unknown' };
      
      return {
        _id: msg._id,
        content: msg.content,
        timestamp: msg.createdAt,
        sender: {
          _id: sender._id,
          username: sender.username,
          profilePicture: sender.profilePicture ? 
            `/uploads/${path.basename(sender.profilePicture)}` : null,
          status: sender.status
        },
        channel: msg.channel,
        isDeleted: msg.isDeleted
      };
    });
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Error getting channel messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * Get direct message conversations
 * @route GET /api/messages/direct/conversations
 * @auth Required
 * @returns {Array} Conversations
 */
router.get('/direct/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all direct conversations where the user is a participant
    const conversations = await Conversation.find({
      type: 'direct',
      participants: userId
    }).populate('participants', 'username profilePicture status');
    
    // Format conversations for client
    const formattedConversations = conversations.map(convo => {
      // Find the other participant
      const otherUser = convo.participants.find(
        p => p._id.toString() !== userId.toString()
      );
      
      if (!otherUser) return null;
      
      return {
        _id: convo._id,
        name: convo.name,
        type: convo.type,
        lastActivity: convo.lastActivity,
        otherUser: {
          _id: otherUser._id,
          username: otherUser.username,
          profilePicture: otherUser.profilePicture ? 
            `/uploads/${path.basename(otherUser.profilePicture)}` : null,
          status: otherUser.status
        }
      };
    }).filter(Boolean);
    
    res.json(formattedConversations);
  } catch (error) {
    console.error('Error getting direct message conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * Send a direct message to a user
 * @route POST /api/messages/direct/:userId
 * @auth Required
 * @param {string} userId - Recipient's user ID
 * @body {string} content - Message content
 * @returns {Object} Created message
 */
router.post('/direct/:userId', auth, async (req, res) => {
  try {
    const { content, startConversation } = req.body;
    const senderId = req.user._id;
    const receiverId = req.params.userId;
    
    // Allow creating a conversation without content if startConversation flag is set
    if ((!content || content.trim() === '') && !startConversation) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Find or create conversation
    // Use the static method to ensure IDs are consistent
    const conversation = await Conversation.findOrCreateDirectConversation(senderId, receiverId);

    // Ensure both users have this conversation in their list
    // This is now handled by the User model methods
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (sender) {
      await sender.addConversation(conversation._id);
    }
    
    if (receiver) {
      await receiver.addConversation(conversation._id);
    }

    // Only create a message if content is provided
    let newMessage = null;
    if (content && content.trim() !== '') {
      // Create new message
      newMessage = new Message({
        content,
        sender: senderId,
        receiver: receiverId,
        conversation: conversation._id,
        messageType: 'direct'
      });

      await newMessage.save();
      
      // Populate sender info
      await newMessage.populate('sender', 'username profilePicture status');
    }
    
    // Format for response - either include message details or just conversation info
    const messageResponse = newMessage ? {
      _id: newMessage._id,
      content: newMessage.content,
      sender: {
        _id: newMessage.sender._id,
        username: newMessage.sender.username,
        profilePicture: newMessage.sender.profilePicture ? 
          `/uploads/${path.basename(newMessage.sender.profilePicture)}` : null
      },
      createdAt: newMessage.createdAt,
      conversationId: conversation._id,
      receiverId: receiverId
    } : {
      // Just return conversation info if no message was created
      conversationId: conversation._id,
      receiverId: receiverId,
      // Include success flag to indicate the conversation was created
      success: true
    };
    
    res.status(201).json(messageResponse);
  } catch (error) {
    console.error('Error sending direct message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;

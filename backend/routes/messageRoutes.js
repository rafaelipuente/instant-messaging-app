const express = require('express');
const router = express.Router();
const { Message, VALID_CHANNELS } = require('../models/messageModel');
const User = require('../models/userModel');
const Conversation = require('../models/channelModel');
const auth = require('../middleware/auth');
const path = require('path');

/**
 * MESSAGE ROUTES
 * --------------
 * This file handles both public channel messages and direct messages.
 * Routes are organized in two sections:
 * 1. Public Channel Routes - for group conversations
 * 2. Direct Message Routes - for 1-on-1 messaging
 */

//===================================================================
// PUBLIC CHANNEL ROUTES
//===================================================================

/**
 * List all available public channels
 * @route GET /api/messages/channels
 * @auth Required
 * @returns {Array} List of valid channel names
 */
router.get('/channels', auth, async (req, res) => {
  try {
    res.json(VALID_CHANNELS);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * Get messages for a specific channel with pagination
 * @route GET /api/messages/channel/:channelName
 * @auth Required
 * @param {string} channelName - Name of the channel (lowercase)
 * @query {number} limit - Max number of messages to return (default: 50)
 * @query {string} before - Timestamp to paginate before
 * @returns {Array} Channel messages
 */
router.get('/channel/:channelName', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const channelName = req.params.channelName.toLowerCase();
    
    // Validate if it's a public channel
    if (!VALID_CHANNELS.includes(channelName)) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Query conditions
    const queryConditions = {
      channel: channelName,
      messageType: 'channel'
    };
    
    // Add before condition if provided
    if (before) {
      queryConditions.createdAt = { $lt: new Date(before) };
    }
    
    // Find messages and populate sender
    const messages = await Message.find(queryConditions)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture status')
      .lean();
      
    // Transform messages for client
    const transformedMessages = messages.map(message => ({
      _id: message._id,
      content: message.content,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        profilePicture: message.sender.profilePicture ? 
          `/uploads/${path.basename(message.sender.profilePicture)}` : null,
        status: message.sender.status
      },
      channel: message.channel,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    }));
    
    res.json(transformedMessages.reverse());
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

//===================================================================
// DIRECT MESSAGE ROUTES
//===================================================================

/**
 * Get all direct message conversations for the current user
 * @route GET /api/messages/direct/conversations
 * @auth Required
 * @returns {Array} List of direct message conversations
 */
router.get('/direct/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user with populated conversations
    const user = await User.findById(userId)
      .populate({
        path: 'conversations.conversationId',
        match: { type: 'direct' },
        populate: {
          path: 'participants',
          select: 'username profilePicture status lastSeen'
        }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format conversations for response
    const conversations = user.conversations
      .filter(conv => conv.conversationId && conv.conversationId.type === 'direct')
      .map(conv => {
        const conversation = conv.conversationId;
        const otherUser = conversation.participants.find(p => 
          !p._id.equals(userId)
        );
        
        return {
          _id: conversation._id,
          name: conversation.name,
          displayName: `Chat with ${otherUser?.username || 'Unknown'}`,
          otherUser: otherUser || null,
          unreadCount: conv.unreadCount,
          lastViewedAt: conv.lastViewedAt
        };
      });
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
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
    const { content } = req.body;
    const senderId = req.user._id;
    const receiverId = req.params.userId;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      // Create a new conversation
      conversation = new Conversation({
        type: 'direct',
        participants: [senderId, receiverId],
        name: `direct-${senderId}-${receiverId}`
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

    // Create new message
    const newMessage = new Message({
      content,
      sender: senderId,
      receiver: receiverId,
      conversation: conversation._id,
      messageType: 'direct'
    });

    await newMessage.save();
    
    // Populate sender info
    await newMessage.populate('sender', 'username profilePicture status');
    
    // Format for response
    const messageResponse = {
      _id: newMessage._id,
      content: newMessage.content,
      sender: {
        _id: newMessage.sender._id,
        username: newMessage.sender.username,
        profilePicture: newMessage.sender.profilePicture ? 
          `/uploads/${path.basename(newMessage.sender.profilePicture)}` : null
      },
      createdAt: newMessage.createdAt
    };
    
    res.status(201).json(messageResponse);
  } catch (error) {
    console.error('Error sending direct message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;

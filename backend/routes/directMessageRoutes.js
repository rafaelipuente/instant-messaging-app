const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const DirectMessage = require('../models/directMessageModel');
const User = require('../models/userModel');

// Start or get a conversation
router.post('/start', auth, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user._id;

    if (userId === otherUserId) {
      return res.status(400).json({ message: "Cannot start chat with yourself" });
    }

    // Check if conversation already exists
    let conversation = await DirectMessage.findOne({
      participants: { $all: [userId, otherUserId] }
    }).populate('participants', 'username');

    if (!conversation) {
      // Create new conversation
      conversation = new DirectMessage({
        participants: [userId, otherUserId],
        messages: []
      });
      await conversation.save();
      conversation = await DirectMessage.findById(conversation._id)
        .populate('participants', 'username');
    }

    res.json({ conversationId: conversation._id });
  } catch (error) {
    console.error('Error starting chat:', error);
    res.status(500).json({ message: 'Error starting chat' });
  }
});

// Get all conversations for a user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await DirectMessage.find({
      participants: req.user._id
    })
    .populate('participants', 'username')
    .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Get messages for a specific conversation
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const conversation = await DirectMessage.findById(req.params.conversationId)
      .populate('messages.sender', 'username')
      .populate('participants', 'username');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is participant
    if (!conversation.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    res.json(conversation.messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Send a message in a conversation (🔥 FIXED WITH SOCKET.IO)
router.post('/:conversationId/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.conversationId;

    const conversation = await DirectMessage.findById(conversationId)
      .populate('participants', 'username');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is participant
    if (!conversation.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to send messages in this conversation' });
    }

    const newMessage = {
      sender: req.user._id,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(newMessage);
    conversation.lastMessage = new Date();
    await conversation.save();

    // Populate sender info for the response
    const populatedMessage = {
      ...newMessage,
      sender: {
        _id: req.user._id,
        username: req.user.username
      }
    };

    res.json(populatedMessage);

    // 🔥 Emit message via Socket.IO
    const roomId = conversation.participants.map(u => u._id.toString()).sort().join('-');
    if (global.io) {
      global.io.to(roomId).emit('newDirectMessage', populatedMessage);
    }

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

module.exports = router;

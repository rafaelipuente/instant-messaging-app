const express = require('express');
const router = express.Router();
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const auth = require('../middleware/auth');

// Get all messages
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ timestamp: 1 })
      .populate('sender', 'username profilePicture');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get direct messages between two users
router.get('/direct/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
    .sort({ timestamp: 1 })
    .populate('sender', 'username profilePicture')
    .populate('receiver', 'username profilePicture');
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Get active chats for a user
router.get('/active-chats', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    }).sort({ timestamp: -1 });

    const userIds = new Set();
    messages.forEach(msg => {
      if (msg.sender.toString() === req.user._id.toString()) {
        userIds.add(msg.receiver.toString());
      } else {
        userIds.add(msg.sender.toString());
      }
    });

    const users = await User.find({
      _id: { $in: Array.from(userIds) }
    }).select('username profilePicture');

    res.json(users);
  } catch (error) {
    console.error('Error fetching active chats:', error);
    res.status(500).json({ message: 'Error fetching active chats' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Message = require('../models/messageModel');
const User = require('../models/userModel');

// Get messages for a specific room
router.get('/:room', async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      .populate('sender', 'username')
      .sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Save a new message
router.post('/', async (req, res) => {
  try {
    const { content, room, username } = req.body;
    
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const message = new Message({
      content,
      room,
      sender: user._id,
      timestamp: new Date()
    });

    await message.save();
    
    // Populate sender information before sending response
    await message.populate('sender', 'username');
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error saving message' });
  }
});

module.exports = router;

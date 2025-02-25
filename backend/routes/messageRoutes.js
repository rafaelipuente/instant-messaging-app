const express = require('express');
const router = express.Router();
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const auth = require('../middleware/auth');
const path = require('path');

// Get messages for a channel
router.get('/channel/:channelName', auth, async (req, res) => {
  try {
    const { channelName } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      channel: channelName,
      messageType: 'channel'
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .lean();

    // Transform messages for client
    const transformedMessages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      timestamp: msg.timestamp,
      messageType: msg.messageType,
      channel: msg.channel,
      sender: {
        _id: msg.sender._id,
        username: msg.sender.username,
        profilePicture: msg.sender.profilePicture ? `/uploads/${path.basename(msg.sender.profilePicture)}` : null
      }
    }));

    res.json(transformedMessages.reverse());
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get messages between two users
router.get('/direct/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const chatId = Message.generateChatId(currentUserId, otherUserId);

    const messages = await Message.find({
      channel: chatId,
      messageType: 'direct'
    })
      .sort({ timestamp: 1 })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .lean();

    // Transform messages for client
    const transformedMessages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      timestamp: msg.timestamp,
      messageType: msg.messageType,
      channel: msg.channel,
      sender: {
        _id: msg.sender._id,
        username: msg.sender.username,
        profilePicture: msg.sender.profilePicture ? `/uploads/${path.basename(msg.sender.profilePicture)}` : null
      },
      receiver: {
        _id: msg.receiver._id,
        username: msg.receiver.username,
        profilePicture: msg.receiver.profilePicture ? `/uploads/${path.basename(msg.receiver.profilePicture)}` : null
      }
    }));

    res.json(transformedMessages);
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Store a new channel message
router.post('/channel/:channelName', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const { channelName } = req.params;

    const message = new Message({
      sender: req.user._id,
      content,
      channel: channelName,
      messageType: 'channel'
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');

    // Transform message for response
    const transformedMessage = {
      _id: message._id,
      content: message.content,
      timestamp: message.timestamp,
      messageType: message.messageType,
      channel: message.channel,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        profilePicture: message.sender.profilePicture ? `/uploads/${path.basename(message.sender.profilePicture)}` : null
      }
    };

    res.status(201).json(transformedMessage);
  } catch (error) {
    console.error('Error saving channel message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Store a new direct message
router.post('/direct/:userId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const senderId = req.user._id;
    const receiverId = req.params.userId;
    const chatId = Message.generateChatId(senderId, receiverId);

    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      channel: chatId,
      messageType: 'direct'
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    // Add users to each other's open chats if not already there
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (!sender.openChats.includes(receiverId)) {
      sender.openChats.push(receiverId);
      await sender.save();
    }

    if (!receiver.openChats.includes(senderId)) {
      receiver.openChats.push(senderId);
      await receiver.save();
    }

    // Transform message for response
    const transformedMessage = {
      _id: message._id,
      content: message.content,
      timestamp: message.timestamp,
      messageType: message.messageType,
      channel: message.channel,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        profilePicture: message.sender.profilePicture ? `/uploads/${path.basename(message.sender.profilePicture)}` : null
      },
      receiver: {
        _id: message.receiver._id,
        username: message.receiver.username,
        profilePicture: message.receiver.profilePicture ? `/uploads/${path.basename(message.receiver.profilePicture)}` : null
      }
    };

    res.status(201).json(transformedMessage);
  } catch (error) {
    console.error('Error saving direct message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Mark messages as read
router.put('/direct/:userId/read', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const chatId = Message.generateChatId(currentUserId, otherUserId);

    await Message.updateMany(
      {
        channel: chatId,
        receiver: currentUserId,
        read: false
      },
      {
        $set: { read: true }
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;

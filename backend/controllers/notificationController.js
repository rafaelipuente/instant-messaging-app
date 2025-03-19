const User = require('../models/userModel');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all notifications for the current user
 */
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        notifications: user.notifications || [],
        unreadMessages: user.unreadMessages ? Object.fromEntries(user.unreadMessages) : {}
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Add a new notification for the current user
 */
exports.addNotification = async (req, res) => {
  try {
    const { type, senderId, sender, senderAvatar, message } = req.body;
    
    if (!type || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const notification = {
      id: uuidv4(),
      type,
      senderId,
      sender,
      senderAvatar,
      message,
      timestamp: new Date(),
      read: false
    };

    await user.addNotification(notification);

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('Error adding notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Notification ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.markNotificationAsRead(notificationId);

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Clear all notifications for the current user
 */
exports.clearNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.clearNotifications();

    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Add an unread message
 */
exports.addUnreadMessage = async (req, res) => {
  try {
    const { senderId, messageId, content, senderName } = req.body;
    
    if (!senderId || !messageId || !content || !senderName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.addUnreadMessage(senderId, messageId, content, senderName);

    res.status(201).json({ success: true, message: 'Unread message added' });
  } catch (error) {
    console.error('Error adding unread message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Clear unread messages for a sender
 */
exports.clearUnreadMessages = async (req, res) => {
  try {
    const { senderId } = req.params;
    
    if (!senderId) {
      return res.status(400).json({ success: false, message: 'Sender ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.clearUnreadMessages(senderId);

    res.status(200).json({ success: true, message: 'Unread messages cleared' });
  } catch (error) {
    console.error('Error clearing unread messages:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  addNotification,
  markAsRead,
  clearNotifications,
  addUnreadMessage,
  clearUnreadMessages
} = require('../controllers/notificationController');

const router = express.Router();

// Protect all notification routes - require authentication
router.use(protect);

// Notification routes
router.get('/', getNotifications);
router.post('/', addNotification);
router.post('/unread', addUnreadMessage);
router.put('/:notificationId/read', markAsRead);
router.delete('/clear', clearNotifications);
router.delete('/unread/:senderId', clearUnreadMessages);

module.exports = router;

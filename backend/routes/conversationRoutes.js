const express = require('express');
const { protect } = require('../middleware/auth');
const { 
  getUserConversations, 
  getConversationById 
} = require('../controllers/conversationController');

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

// Get all user's conversations
router.get('/', getUserConversations);

// Get a specific conversation by ID
router.get('/:conversationId', getConversationById);

module.exports = router;

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const ChatRoom = require('../models/chatRoomModel');

const router = express.Router();

// POST: Create a new chat room
router.post('/create', protect, async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ message: 'Please provide a room name' });
        }

        // Create the chat room
        const chatRoom = await ChatRoom.create({
            name,
            createdBy: req.user._id, // Use the authenticated user's ID
            participants: [req.user._id], // Add the creator as a participant
        });

        res.status(201).json(chatRoom);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

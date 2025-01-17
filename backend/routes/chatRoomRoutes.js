const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const ChatRoom = require('../models/chatRoomModel');

const router = express.Router();


// GET: List all chat rooms
router.get('/', protect, async (req, res) => {
    try {
        const chatRooms = await ChatRoom.find();
        res.status(200).json(chatRooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE: Delete a chat room
router.delete('/:id', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id);

        if (!chatRoom) {
            return res.status(404).json({ message: 'Chat room not found' });
        }

        // Check if the authenticated user is the creator of the chat room
        if (chatRoom.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this chat room' });
        }

        await ChatRoom.deleteOne({ _id: chatRoom._id });
        res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



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

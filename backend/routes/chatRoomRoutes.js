const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const ChatRoom = require('../models/chatRoomModel');

const router = express.Router();

// GET: List all chat rooms
router.get('/', protect, async (req, res) => {
    try {
        console.log('Fetching all chat rooms...');
        const chatRooms = await ChatRoom.find();
        res.status(200).json(chatRooms);
    } catch (error) {
        console.error('Error fetching chat rooms:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE: Delete a chat room
router.delete('/:id', protect, async (req, res) => {
    try {
        console.log(`Attempting to delete chat room with ID: ${req.params.id}`);
        const chatRoom = await ChatRoom.findById(req.params.id);

        if (!chatRoom) {
            console.log('Chat room not found');
            return res.status(404).json({ message: 'Chat room not found' });
        }

        // Check if the authenticated user is the creator of the chat room
        if (chatRoom.createdBy.toString() !== req.user._id.toString()) {
            console.log(`User ${req.user._id} not authorized to delete chat room ${req.params.id}`);
            return res.status(403).json({ message: 'Not authorized to delete this chat room' });
        }

        await ChatRoom.deleteOne({ _id: chatRoom._id });
        console.log(`Chat room ${req.params.id} deleted successfully`);
        res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat room:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST: Create a new chat room
router.post('/create', protect, async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) {
            console.log('Chat room creation failed: Missing room name');
            return res.status(400).json({ message: 'Please provide a room name' });
        }

        // Create the chat room
        const chatRoom = await ChatRoom.create({
            name,
            createdBy: req.user._id, // Use the authenticated user's ID
            participants: [req.user._id], // Add the creator as a participant
        });

        console.log(`Chat room "${name}" created by user ${req.user._id}`);
        res.status(201).json(chatRoom);
    } catch (error) {
        console.error('Error creating chat room:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
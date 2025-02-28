const express = require('express');
const { protect } = require('../middleware/auth');
const Conversation = require('../models/channelModel');
const User = require('../models/userModel');

const router = express.Router();

// GET: List all chat rooms
router.get('/', protect, async (req, res) => {
    try {
        console.log('Fetching all chat rooms...');
        // Only get non-default chat rooms (custom group chats)
        const chatRooms = await Conversation.find({
            type: 'channel',
            isDefaultChannel: false
        }).populate('createdBy', 'username profilePicture');
        
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
        const chatRoom = await Conversation.findById(req.params.id);

        if (!chatRoom) {
            console.log('Chat room not found');
            return res.status(404).json({ message: 'Chat room not found' });
        }

        // Check if the authenticated user is the creator of the chat room
        if (chatRoom.createdBy.toString() !== req.user._id.toString()) {
            console.log('User not authorized to delete this chat room');
            return res.status(401).json({ message: 'User not authorized to delete this chat room' });
        }

        const result = await Conversation.findByIdAndDelete(req.params.id);
        
        // Remove this chat room from all users' conversations
        await User.updateMany(
            { 'conversations.conversationId': req.params.id },
            { $pull: { conversations: { conversationId: req.params.id } } }
        );
        
        console.log('Chat room deleted successfully');
        res.status(200).json({ message: 'Chat room deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat room:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST: Create a new chat room
router.post('/', protect, async (req, res) => {
    try {
        console.log('Creating new chat room with data:', req.body);
        const { name, description } = req.body;

        // Check if a chat room with this name already exists
        const existingRoom = await Conversation.findOne({ name: name.toLowerCase() });
        if (existingRoom) {
            console.log('Chat room with this name already exists');
            return res.status(400).json({ message: 'Chat room with this name already exists' });
        }

        const newChatRoom = await Conversation.create({
            name: name.toLowerCase(),
            displayName: name,
            description: description || '',
            type: 'channel',
            createdBy: req.user._id,
            participants: [req.user._id],
            isDefaultChannel: false
        });

        // Add this chat room to the creator's conversations
        const user = await User.findById(req.user._id);
        await user.addConversation(newChatRoom._id);

        console.log('New chat room created successfully');
        res.status(201).json(newChatRoom);
    } catch (error) {
        console.error('Error creating chat room:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

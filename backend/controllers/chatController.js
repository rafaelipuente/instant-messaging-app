const ChatRoom = require('../models/chatRoomModel');
const Message = require('../models/messageModel');

// Get All Chat Rooms
const getAllChatRooms = async (req, res) => {
    try {
        const chatRooms = await ChatRoom.find();
        res.status(200).json(chatRooms);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create a New Chat Room
const createChatRoom = async (req, res) => {
    const { name } = req.body;

    try {
        const newChatRoom = new ChatRoom({ name });
        await newChatRoom.save();
        res.status(201).json({ message: 'Chat room created successfully', chatRoom: newChatRoom });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get Messages for a Chat Room
const getMessages = async (req, res) => {
    const { roomId } = req.params;

    try {
        const messages = await Message.find({ room: roomId }).sort({ createdAt: 1 });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getAllChatRooms, createChatRoom, getMessages };

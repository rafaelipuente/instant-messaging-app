const mongoose = require('mongoose');

// Chat Room Schema
const chatRoomSchema = mongoose.Schema(
    {
        name: { type: String, required: true }, // Chat room name
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User who created the room
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of users in the room
    },
    { timestamps: true } // Add createdAt and updatedAt fields
);

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;

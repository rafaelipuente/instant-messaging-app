const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    messages: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            content: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
        },
    ],
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);

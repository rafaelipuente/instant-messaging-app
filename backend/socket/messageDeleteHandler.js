const mongoose = require('mongoose');
const { Message } = require('../models/messageModel');

const handleMessageDeletion = async (io, socket, data) => {
  try {
    const { messageId } = data;
    
    console.log(`[DELETE] Handling message deletion for ${messageId} by ${socket.user.username} (${socket.user._id})`);
    
    if (!messageId) {
      console.log(`[DELETE ERROR] No messageId provided`);
      return socket.emit('messageError', { error: 'No message ID provided' });
    }
    
    // Ensure messageId is a string and trim any whitespace
    const messageIdStr = String(messageId).trim();
    
    // Ensure messageId is valid
    if (!mongoose.Types.ObjectId.isValid(messageIdStr)) {
      console.log(`[DELETE ERROR] Invalid message ID format: ${messageIdStr}`);
      return socket.emit('messageError', { error: 'Invalid message ID format' });
    }
    
    const currentUserId = socket.user._id.toString();
    
    // Find the message to get its details before deletion
    console.log(`[DELETE] Attempting to find message with ID: ${messageId}`);
    const message = await Message.findById(messageIdStr);
    
    if (!message) {
      console.log(`[DELETE ERROR] Message ${messageId} not found`);
      return socket.emit('messageError', { error: 'Message not found' });
    }
    
    const senderId = message.sender.toString();
    
    // Check if the current user is the sender
    if (senderId !== currentUserId) {
      console.log(`[DELETE ERROR] Unauthorized deletion attempt by ${currentUserId} for message ${messageId} from ${senderId}`);
      return socket.emit('messageError', { error: 'Unauthorized to delete this message' });
    }
    
    // Delete the message
    await Message.findByIdAndDelete(messageIdStr);
    console.log(`[DELETE] Message ${messageId} deleted successfully`);
    
    // Determine the appropriate notification based on message type
    if (message.channel && !message.receiver) {
      // This is a channel message
      io.to(message.channel).emit('messageDeleted', { messageId: messageIdStr });
    } else if (message.receiver) {
      // This is a direct message, notify both users
      const receiverId = message.receiver.toString();
      io.to(currentUserId).emit('messageDeleted', { messageId: messageIdStr });
      io.to(receiverId).emit('messageDeleted', { messageId: messageIdStr });
    }
    
    // Send success to the client
    socket.emit('messageDeleted', { success: true, messageId: messageIdStr });
    
  } catch (error) {
    console.error('[DELETE ERROR] Error handling message deletion:', error);
    console.error('[DELETE ERROR] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to delete message' });
  }
};

module.exports = {
  handleMessageDeletion
};

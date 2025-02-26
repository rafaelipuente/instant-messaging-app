const Message = require('../models/messageModel');
const User = require('../models/userModel');
const path = require('path');

const handleChannelMessage = async (io, socket, data) => {
  try {
    const { content, channel } = data;
    const channelName = channel.toLowerCase();

    console.log(`Handling channel message in ${channelName} from ${socket.user.username}`);

    // Create and save the message
    const message = new Message({
      sender: socket.user._id,
      content,
      channel: channelName,
      messageType: 'channel'
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');

    // Transform message for broadcasting
    const transformedMessage = {
      _id: message._id,
      content: message.content,
      timestamp: message.timestamp,
      messageType: message.messageType,
      channel: message.channel,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        profilePicture: message.sender.profilePicture ? `/uploads/${path.basename(message.sender.profilePicture)}` : null
      }
    };

    console.log(`Broadcasting channel message to ${channelName}`);
    // Broadcast to everyone in the channel including sender
    io.to(channelName).emit('newChannelMessage', transformedMessage);

  } catch (error) {
    console.error('Error handling channel message:', error);
    console.error('Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to send message' });
  }
};

const handleDirectMessage = async (io, socket, data) => {
  try {
    const { content, receiverId } = data;
    const senderId = socket.user._id;
    const chatId = Message.generateChatId(senderId, receiverId);

    console.log(`Handling direct message in ${chatId} from ${socket.user.username} to ${receiverId}`);

    // Create and save the message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      channel: chatId,
      messageType: 'direct'
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    // Add users to each other's open chats if not already there
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (!sender.openChats.includes(receiverId)) {
      sender.openChats.push(receiverId);
      await sender.save();
    }

    if (!receiver.openChats.includes(senderId)) {
      receiver.openChats.push(senderId);
      await receiver.save();
    }

    // Transform message for broadcasting
    const transformedMessage = {
      _id: message._id,
      content: message.content,
      timestamp: message.timestamp,
      messageType: message.messageType,
      channel: message.channel,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        profilePicture: message.sender.profilePicture ? `/uploads/${path.basename(message.sender.profilePicture)}` : null
      },
      receiver: {
        _id: message.receiver._id,
        username: message.receiver.username,
        profilePicture: message.receiver.profilePicture ? `/uploads/${path.basename(message.receiver.profilePicture)}` : null
      }
    };

    console.log(`Sending direct message to ${senderId} and ${receiverId}`);
    // Send to both sender and receiver
    io.to(senderId.toString()).emit('newDirectMessage', transformedMessage);
    io.to(receiverId.toString()).emit('newDirectMessage', transformedMessage);

  } catch (error) {
    console.error('Error handling direct message:', error);
    console.error('Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to send message' });
  }
};

const handleMessageDeletion = async (io, socket, data) => {
  try {
    const { messageId } = data;
    
    console.log(`Handling message deletion for ${messageId} by ${socket.user.username}`);
    
    // Find the message to get its details before deletion
    const message = await Message.findById(messageId);
    
    if (!message) {
      console.log(`Message ${messageId} not found`);
      return socket.emit('messageError', { error: 'Message not found' });
    }
    
    // Check if the user is authorized to delete this message
    if (message.sender.toString() !== socket.user._id.toString()) {
      console.log(`Unauthorized deletion attempt by ${socket.user.username}`);
      return socket.emit('messageError', { error: 'Unauthorized to delete this message' });
    }
    
    // Delete the message
    await Message.findByIdAndDelete(messageId);
    
    // Notify clients about deletion
    if (message.messageType === 'channel') {
      console.log(`Broadcasting channel message deletion to ${message.channel}`);
      io.to(message.channel).emit('messageDeleted', { messageId });
    } else if (message.messageType === 'direct') {
      const otherUserId = message.sender.toString() === socket.user._id.toString() 
        ? message.receiver.toString() 
        : message.sender.toString();
      
      console.log(`Sending direct message deletion to ${socket.user._id} and ${otherUserId}`);
      io.to(socket.user._id.toString()).emit('messageDeleted', { messageId });
      io.to(otherUserId).emit('messageDeleted', { messageId });
    }
    
  } catch (error) {
    console.error('Error handling message deletion:', error);
    console.error('Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to delete message' });
  }
};

module.exports = {
  handleChannelMessage,
  handleDirectMessage,
  handleMessageDeletion
};

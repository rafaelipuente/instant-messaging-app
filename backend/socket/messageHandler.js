const Message = require('../models/messageModel');
const User = require('../models/userModel');

const handleChannelMessage = async (io, socket, data) => {
  try {
    const { content, channel } = data;
    const channelName = channel.toLowerCase();

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
        profilePicture: message.sender.profilePicture
      }
    };

    // Broadcast to everyone in the channel including sender
    io.to(channelName).emit('newChannelMessage', transformedMessage);

  } catch (error) {
    console.error('Error handling channel message:', error);
    socket.emit('messageError', { error: 'Failed to send message' });
  }
};

const handleDirectMessage = async (io, socket, data) => {
  try {
    const { content, receiverId } = data;
    const senderId = socket.user._id;
    const chatId = Message.generateChatId(senderId, receiverId);

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
        profilePicture: message.sender.profilePicture
      },
      receiver: {
        _id: message.receiver._id,
        username: message.receiver.username,
        profilePicture: message.receiver.profilePicture
      }
    };

    // Send to both sender and receiver
    io.to(senderId.toString()).emit('newDirectMessage', transformedMessage);
    io.to(receiverId.toString()).emit('newDirectMessage', transformedMessage);

  } catch (error) {
    console.error('Error handling direct message:', error);
    socket.emit('messageError', { error: 'Failed to send message' });
  }
};

module.exports = {
  handleChannelMessage,
  handleDirectMessage
};

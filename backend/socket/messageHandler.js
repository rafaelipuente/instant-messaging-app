const Message = require('../models/messageModel');
const User = require('../models/userModel');
const path = require('path');
const mongoose = require('mongoose'); // Add this line

// Constants
const VALID_CHANNELS = ['general', 'tech-talk', 'random', 'music'];

// Helper function to transform message for client
const transformMessage = (message) => ({
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
  receiver: message.receiver ? {
    _id: message.receiver._id,
    username: message.receiver.username,
    profilePicture: message.receiver.profilePicture ? `/uploads/${path.basename(message.receiver.profilePicture)}` : null
  } : null
});

const handleChannelMessage = async (io, socket, data) => {
  try {
    const { content, channel } = data;
    const channelName = channel.toLowerCase();

    // Validate channel
    if (!VALID_CHANNELS.includes(channelName)) {
      throw new Error('Invalid channel');
    }

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
    io.to(channelName).emit('channelMessage', transformedMessage);

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

    console.log('Sending direct message:', transformedMessage);

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
    
    console.log(`[DELETE] Handling message deletion for ${messageId} by ${socket.user.username} (${socket.user._id})`);
    console.log(`[DELETE] Data received:`, JSON.stringify(data));
    
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
    
    // Find the message to get its details before deletion
    console.log(`[DELETE] Attempting to find message with ID: ${messageIdStr}`);
    const message = await Message.findById(messageIdStr);
    
    if (!message) {
      console.log(`[DELETE ERROR] Message ${messageIdStr} not found`);
      return socket.emit('messageError', { error: 'Message not found' });
    }
    
    console.log(`[DELETE] Message found:`, JSON.stringify({
      _id: message._id.toString(),
      sender: message.sender.toString(),
      receiver: message.receiver ? message.receiver.toString() : null,
      messageType: message.messageType,
      channel: message.channel
    }));
    
    // Check if the user is authorized to delete this message
    const messageSenderId = message.sender.toString();
    const currentUserId = socket.user._id.toString();
    
    console.log(`[DELETE] Message sender: ${messageSenderId}, Current user: ${currentUserId}`);
    
    if (messageSenderId !== currentUserId) {
      console.log(`[DELETE ERROR] Unauthorized deletion attempt by ${socket.user.username}`);
      console.log(`[DELETE ERROR] Message sender: ${messageSenderId}, User ID: ${currentUserId}`);
      return socket.emit('messageError', { error: 'Unauthorized to delete this message' });
    }
    
    // Delete the message
    console.log(`[DELETE] Deleting message ${messageIdStr}`);
    const deleteResult = await Message.findByIdAndDelete(messageIdStr);
    console.log(`[DELETE] Delete result:`, deleteResult ? 'Success' : 'Failed');
    
    // Notify clients about deletion
    if (message.messageType === 'channel') {
      console.log(`[DELETE] Broadcasting channel message deletion to ${message.channel}`);
      io.to(message.channel).emit('messageDeleted', { messageId: messageIdStr });
    } else if (message.messageType === 'direct') {
      // For direct messages, we need to emit to both users directly
      console.log(`[DELETE] Sending direct message deletion notification for message ${messageIdStr}`);
      
      // Get the other user's ID
      const receiverId = message.receiver ? message.receiver.toString() : null;
      
      if (!receiverId) {
        console.log(`[DELETE WARNING] No receiver found for direct message ${messageIdStr}`);
      } else {
        console.log(`[DELETE] Current user: ${currentUserId}, Receiver: ${receiverId}`);
      }
      
      // Emit to the current user
      socket.emit('messageDeleted', { messageId: messageIdStr });
      
      // Find the other user's socket and emit to them if they're online
      if (receiverId) {
        const connectedSockets = Array.from(io.sockets.sockets.values());
        console.log(`[DELETE] Total connected sockets: ${connectedSockets.length}`);
        
        const otherUserSocket = connectedSockets.find(s => 
          s.user && s.user._id && s.user._id.toString() === receiverId
        );
        
        if (otherUserSocket) {
          console.log(`[DELETE] Found socket for receiver ${receiverId}, sending deletion notification`);
          otherUserSocket.emit('messageDeleted', { messageId: messageIdStr });
        } else {
          console.log(`[DELETE] Receiver ${receiverId} not connected, skipping notification`);
        }
      }
    }
    
    // Send success confirmation to the client
    console.log(`[DELETE] Sending success confirmation to client for message ${messageIdStr}`);
    socket.emit('messageDeleteSuccess', { messageId: messageIdStr });
    
  } catch (error) {
    console.error('[DELETE ERROR] Error handling message deletion:', error);
    console.error('[DELETE ERROR] Error details:', error.stack);
    socket.emit('messageError', { error: 'Failed to delete message' });
  }
};

const loadInitialMessages = async (socket, data) => {
  try {
    console.log(`Loading initial messages for user ${socket.user.username}`, data);
    
    // Validate the data
    if (!data) {
      throw new Error('Invalid data provided');
    }
    
    let messages = [];
    
    // Load channel messages
    if (data.channel) {
      const channelName = data.channel.toLowerCase();
      
      // Validate channel
      const validChannels = ['general', 'tech-talk', 'random', 'music'];
      if (!validChannels.includes(channelName)) {
        console.warn(`Invalid channel: ${channelName}`);
        socket.emit('error', { message: 'Invalid channel' });
        return;
      }
      
      console.log(`Loading messages for channel: ${channelName}`);
      
      // Join the channel
      socket.join(channelName);
      
      // Get messages for the channel
      messages = await Message.find({ 
        channel: channelName,
        messageType: 'channel'
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('sender', 'username profilePicture')
      .lean();
    } 
    // Load direct messages
    else if (data.userId) {
      const currentUserId = socket.user._id.toString();
      const otherUserId = data.userId;
      
      console.log(`Loading direct messages between ${currentUserId} and ${otherUserId}`);
      
      // Get direct messages between the two users
      messages = await Message.find({
        messageType: 'direct',
        $or: [
          { sender: currentUserId, receiver: otherUserId },
          { sender: otherUserId, receiver: currentUserId }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('sender', 'username profilePicture')
      .lean();
    } else {
      throw new Error('Invalid request: missing channel or userId');
    }
    
    // Transform messages for client
    const transformedMessages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      timestamp: msg.timestamp,
      messageType: msg.messageType,
      channel: msg.channel,
      sender: {
        _id: msg.sender._id,
        username: msg.sender.username,
        profilePicture: msg.sender.profilePicture || null
      },
      receiver: msg.receiver
    }));
    
    // Send previous messages to the user (reversed to show oldest first)
    socket.emit('previousMessages', transformedMessages.reverse());
    
    return { success: true, count: transformedMessages.length };
  } catch (error) {
    console.error('Error loading initial messages:', error);
    socket.emit('messageError', { error: 'Failed to load messages' });
    return { success: false, error: error.message };
  }
};

const handleConnection = async (io, socket) => {
  try {
    // Join user to their own room for direct messages
    socket.join(socket.user._id.toString());
    
    // Join default channels
    VALID_CHANNELS.forEach(channel => {
      socket.join(channel);
      console.log(`User ${socket.user.username} joined channel: ${channel}`);
    });

    // Notify others of user connection
    socket.broadcast.emit('userConnected', {
      userId: socket.user._id,
      username: socket.user.username
    });

  } catch (error) {
    console.error('Error handling connection:', error);
  }
};

module.exports = {
  handleChannelMessage,
  handleDirectMessage,
  handleMessageDeletion,
  loadInitialMessages,
  handleConnection
};

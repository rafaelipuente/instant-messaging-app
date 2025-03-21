const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const User = require('../../models/userModel');
const Message = require('../../models/messageModel');
const Channel = require('../../models/chatRoomModel'); // Using chatRoomModel as our channel

let mongoServer;

// Connect to in-memory database
const setupTestDB = async () => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }
};

// Disconnect and reset the database
const teardownTestDB = async () => {
  if (mongoServer) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongoServer.stop();
    mongoServer = null;
  }
};

// Clear data between tests
const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

// Create test users
const createTestUsers = async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const users = [
    {
      username: 'testuser1',
      email: 'test1@example.com',
      password: passwordHash,
    },
    {
      username: 'testuser2',
      email: 'test2@example.com',
      password: passwordHash,
    }
  ];
  
  const createdUsers = await User.insertMany(users);
  return createdUsers;
};

// Create test channels
const createTestChannels = async () => {
  const channels = [
    { name: 'General', description: 'General discussion' },
    { name: 'Random', description: 'Random topics' }
  ];
  
  const createdChannels = await Channel.insertMany(channels);
  return createdChannels;
};

// Create test messages
const createTestMessages = async (users, channels) => {
  const messages = [
    {
      content: 'Hello from user 1',
      sender: users[0]._id,
      channel: channels[0]._id
    },
    {
      content: 'Hello from user 2',
      sender: users[1]._id,
      channel: channels[0]._id
    },
    {
      content: 'Direct message from user 1 to user 2',
      sender: users[0]._id,
      receiver: users[1]._id
    }
  ];
  
  const createdMessages = await Message.insertMany(messages);
  return createdMessages;
};

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearDatabase,
  createTestUsers,
  createTestChannels,
  createTestMessages
};

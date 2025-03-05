const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Message, VALID_CHANNELS } = require('../models/messageModel'); // Using the unified message model

// Load environment variables
require('dotenv').config();

// Use the same secret everywhere
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use a more deterministic filename
    const userId = req.user._id;
    const fileExt = path.extname(file.originalname);
    const filename = `${userId}-${Date.now()}${fileExt}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Debug middleware
router.use((req, res, next) => {
  console.log('User Route:', req.method, req.url);
  next();
});

// Get all users except the current user
router.get('/all-users', auth, async (req, res) => {
  try {
    console.log('Fetching all users...');
    const users = await User.find(
      { _id: { $ne: req.user._id } }, // Exclude the current user
      'username name profilePicture'
    );
    console.log('Found users:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if username already exists (case insensitive)
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user with consistent username case
    const user = new User({
      username: username.toLowerCase(),
      password,
      name: name || username, // Use username as name if not provided
      status: 'online'
    });

    await user.save();
    
    // Add user to default channels
    try {
      const Conversation = require('../models/channelModel');
      const defaultChannels = await Conversation.findOrCreateDefaultChannels(user._id);
      console.log(`User ${username} added to default channels:`, defaultChannels.map(c => c.name).join(', '));
    } catch (channelError) {
      console.error('Error adding user to default channels:', channelError);
      // Continue registration process even if channel addition fails
    }
    
    // Generate token
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('New user registered:', username);
    res.status(201).json({ 
      token, 
      user: {
        _id: user._id,
        username: user.username,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error in user registration:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt received:', { 
      username: req.body.username,
      hasPassword: req.body.password ? 'Yes' : 'No'
    });
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.error('Login failed: Missing credentials');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    console.log('Finding user with username:', username.toLowerCase());
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      console.error('Login failed: User not found -', username.toLowerCase());
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    console.log('User found, comparing password');
    
    // Compare password
    try {
      const isMatch = await user.comparePassword(password);
      console.log('Password comparison result:', isMatch);
      
      if (!isMatch) {
        console.error('Login failed: Invalid password for user', username.toLowerCase());
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    } catch (passwordError) {
      console.error('Error comparing password:', passwordError);
      return res.status(500).json({ error: 'Error validating credentials' });
    }

    // Generate JWT token
    console.log('Generating JWT token');
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful for user:', username.toLowerCase());
    
    // Return user data and token, handling the case where openChats might not exist
    res.json({
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture ? `/uploads/${path.basename(user.profilePicture)}` : null,
        status: user.status,
        openChats: [] // Providing an empty array instead of trying to access a field that might not exist
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Upload profile picture
router.post('/upload-profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      const oldPicturePath = path.join(uploadDir, path.basename(user.profilePicture));
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }

    // Update user's profile picture path
    const profilePicturePath = `/uploads/${req.file.filename}`;
    user.profilePicture = profilePicturePath;
    await user.save();

    res.json({ profilePicture: profilePicturePath });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Get list of all users
router.get('/list', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const users = await User.find(
      { _id: { $ne: currentUserId } },
      'username profilePicture'
    ).lean();

    // Transform profile picture paths to full URLs
    const usersWithFullPicturePaths = users.map(user => ({
      ...user,
      profilePicture: user.profilePicture ? `/uploads/${path.basename(user.profilePicture)}` : null
    }));

    console.log('Sending users list:', usersWithFullPicturePaths);
    res.json(usersWithFullPicturePaths);
  } catch (error) {
    console.error('Error in /list route:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user profile
router.put('/profile', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    const { name, username, status } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!name && !username && !status && !req.file) {
      return res.status(400).json({ message: 'No changes provided' });
    }

    // Check if username is being changed and if it's already taken
    if (username) {
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle profile picture update
    let profilePicturePath = currentUser.profilePicture;
    if (req.file) {
      // Delete old profile picture if it exists
      if (currentUser.profilePicture) {
        const oldPicturePath = path.join(uploadDir, path.basename(currentUser.profilePicture));
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }
      profilePicturePath = req.file.filename;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name: name || currentUser.name,
        username: username ? username.toLowerCase() : currentUser.username,
        status: status || currentUser.status,
        profilePicture: profilePicturePath
      },
      { new: true }
    );

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      name: updatedUser.name,
      status: updatedUser.status,
      profilePicture: updatedUser.profilePicture ? `/uploads/${path.basename(updatedUser.profilePicture)}` : null
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Temporary route to delete all data
router.delete('/delete-all-data', async (req, res) => {
  try {
    // Delete all users
    await User.deleteMany({});
    
    // Delete all messages
    await Message.deleteMany({});
    
    // Verify counts
    const userCount = await User.countDocuments();
    const messageCount = await Message.countDocuments();
    
    console.log('All data deleted. Counts:', {
      users: userCount,
      messages: messageCount
    });
    
    res.json({ 
      message: 'All data deleted',
      counts: {
        users: userCount,
        messages: messageCount
      }
    });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

// Get user by ID
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, '-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Get open chats for user
router.get('/open-chats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('openChats', 'username profilePicture status')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.openChats) {
      return res.json([]);
    }

    const openChats = user.openChats.map(chat => ({
      _id: chat._id,
      username: chat.username,
      status: chat.status,
      profilePicture: chat.profilePicture ? `/uploads/${path.basename(chat.profilePicture)}` : null
    }));

    res.json(openChats);
  } catch (error) {
    console.error('Error fetching open chats:', error);
    res.status(500).json({ error: 'Failed to fetch open chats' });
  }
});

// Add chat to open chats
router.post('/open-chats/:userId', auth, async (req, res) => {
  try {
    const chatUserId = req.params.userId;
    const currentUserId = req.user._id;

    // Don't add self to open chats
    if (chatUserId === currentUserId.toString()) {
      return res.status(400).json({ error: 'Cannot add self to open chats' });
    }

    // Check if chat user exists
    const chatUser = await User.findById(chatUserId);
    if (!chatUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to open chats if not already there
    const user = await User.findById(currentUserId);
    if (!user.openChats) {
      user.openChats = [];
    }
    
    if (!user.openChats.includes(chatUserId)) {
      user.openChats.push(chatUserId);
      await user.save();
    }

    // Return the updated chat user info
    res.json({
      _id: chatUser._id,
      username: chatUser.username,
      status: chatUser.status,
      profilePicture: chatUser.profilePicture ? `/uploads/${path.basename(chatUser.profilePicture)}` : null
    });
  } catch (error) {
    console.error('Error adding open chat:', error);
    res.status(500).json({ error: 'Failed to add open chat' });
  }
});

// Remove chat from open chats
router.delete('/open-chats/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const userIdToRemove = req.params.userId;

    console.log('Removing chat with user ID:', userIdToRemove);
    console.log('Current user ID:', currentUserId);
    
    // Try both formats - direct and with dm prefix
    const possibleChatIds = [
      // Normal id format: dm-id1-id2
      `dm-${[currentUserId.toString(), userIdToRemove].sort().join('-')}`,
      // Just try with the user ID directly
      userIdToRemove
    ];
    
    console.log('Possible chat IDs to delete:', possibleChatIds);

    // Delete all messages in this chat with any possible ID format
    const deleteResult = await Message.deleteMany({
      $or: [
        // Try direct messageType
        {
          channel: { $in: possibleChatIds },
          messageType: 'direct'
        },
        // Also try without messageType specified
        {
          channel: { $in: possibleChatIds }
        },
        // Also try with sender/receiver format
        {
          $or: [
            { sender: userIdToRemove, receiver: currentUserId },
            { sender: currentUserId, receiver: userIdToRemove }
          ]
        }
      ]
    });
    
    console.log('Delete result:', deleteResult);

    // Remove from open chats
    const user = await User.findById(currentUserId);
    if (user.openChats && Array.isArray(user.openChats)) {
      user.openChats = user.openChats.filter(id => {
        return id && id.toString() !== userIdToRemove;
      });
      await user.save();
    }

    res.json({ 
      message: 'Chat removed and messages deleted successfully', 
      deletedCount: deleteResult.deletedCount 
    });
  } catch (error) {
    console.error('Error removing from open chats:', error);
    res.status(500).json({ error: `Failed to remove from open chats: ${error.message}` });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/messageModel'); // Assuming Message model is defined in messageModel.js
const DirectMessage = require('../models/directMessageModel'); // Assuming DirectMessage model is defined in directMessageModel.js

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.username);
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create token (using JWT_SECRET from env)
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response
    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        profilePicture: user.profilePicture
      }
    });

    console.log('Login successful for:', username);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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

// Get list of users for direct messaging
router.get('/list', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id.toString(); // Convert to string for comparison
    console.log('Current user requesting list:', currentUserId);

    // Find all users
    const users = await User.find({}, 'username name profilePicture status');
    
    // Filter out the current user
    const filteredUsers = users.filter(user => user._id.toString() !== currentUserId);
    
    console.log(`Found ${filteredUsers.length} other users`);
    res.json(filteredUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
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

    // Prepare update object
    const updateData = {
      name: name || currentUser.name,
      username: username ? username.toLowerCase() : currentUser.username,
      status: status || currentUser.status
    };

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if it exists
      if (currentUser.profilePicture) {
        const oldPicturePath = path.join(__dirname, '..', currentUser.profilePicture);
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }

      updateData.profilePicture = '/uploads/' + req.file.filename;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new token (again, using JWT_SECRET from env)
    const token = jwt.sign(
      { 
        _id: updatedUser._id,
        username: updatedUser.username,
        profilePicture: updatedUser.profilePicture
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Emit user update event using global io instance
    if (global.io) {
      global.io.emit('userUpdated', updatedUser);
    }

    // Return updated user data with token
    res.json({
      ...updatedUser.toObject(),
      profilePicture: updatedUser.profilePicture,
      token
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Temporary route to delete all data
router.delete('/delete-all-data', async (req, res) => {
  try {
    // Delete all users
    await User.deleteMany({});
    
    // Delete all messages
    await Message.deleteMany({});
    
    // Delete all direct messages
    await DirectMessage.deleteMany({});
    
    // Verify counts
    const userCount = await User.countDocuments();
    const messageCount = await Message.countDocuments();
    const dmCount = await DirectMessage.countDocuments();
    
    console.log('All data deleted. Counts:', {
      users: userCount,
      messages: messageCount,
      directMessages: dmCount
    });
    
    res.json({ 
      message: 'All data deleted',
      counts: {
        users: userCount,
        messages: messageCount,
        directMessages: dmCount
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

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    // Validate input
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check username length
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user
    const user = new User({
      username: username.toLowerCase(),
      password, // Will be hashed by the pre-save middleware
      name
    });

    await user.save();
    console.log('User registered:', username);

    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.username);
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password using bcrypt directly
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch ? 'Yes' : 'No');

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      'your_jwt_secret', // Use environment variable in production
      { expiresIn: '24h' }
    );

    // Send user data (excluding password) and token
    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      status: 'online',
      profilePicture: user.profilePicture,
      token
    };

    console.log('Login successful for:', username);
    res.json(userResponse);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Error getting profile' });
  }
});

// Update user profile
router.put('/profile/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.name = name;
    await user.save();

    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      status: user.status,
      profilePicture: user.profilePicture
    };

    res.json(userResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Upload profile picture
router.post('/upload-profile-picture', auth, (req, res, next) => {
  console.log('=== Starting Upload Process ===');
  console.log('Headers:', req.headers);
  console.log('Auth user:', req.user);
  
  upload.single('profilePicture')(req, res, async function(err) {
    console.log('=== Multer Processing ===');
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      console.log('File from request:', req.file);
      
      if (!req.file) {
        console.error('No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('Looking up user:', req.user.userId);
      const user = await User.findById(req.user.userId);
      
      if (!user) {
        console.error('User not found:', req.user.userId);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Found user:', user.username);

      // Update user's profile picture path
      const filePath = req.file.path;
      const baseDir = path.join(__dirname, '..');
      console.log('Base directory:', baseDir);
      console.log('File path:', filePath);

      const relativePath = path.relative(baseDir, filePath);
      console.log('Relative path:', relativePath);

      user.profilePicture = '/' + relativePath.replace(/\\/g, '/');
      console.log('Final profile picture path:', user.profilePicture);
      
      await user.save();
      console.log('User updated successfully');

      res.json({ 
        profilePicture: user.profilePicture,
        message: 'Profile picture updated successfully' 
      });
    } catch (error) {
      console.error('=== Error Details ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Error uploading file: ' + error.message });
    }
  });
});

module.exports = router;

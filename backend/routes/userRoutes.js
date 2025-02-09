const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username,
      name,
      email,
      password: hashedPassword
    });

    await user.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Don't send password in response
    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      bio: user.bio,
      twitter: user.twitter,
      github: user.github,
      linkedin: user.linkedin
    };

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { username, name, email, bio, twitter, github, linkedin } = req.body;
    
    // Find and update user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    user.username = username || user.username;
    user.name = name || user.name;
    user.email = email || user.email;
    user.bio = bio || user.bio;
    user.twitter = twitter || user.twitter;
    user.github = github || user.github;
    user.linkedin = linkedin || user.linkedin;

    await user.save();

    // Don't send password in response
    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      bio: user.bio,
      twitter: user.twitter,
      github: user.github,
      linkedin: user.linkedin
    };

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel'); // Import User model

const router = express.Router();

// POST: Register a new user
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide all fields' });
        }

        // Check if the user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create and save the new user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        // Respond with user data
        if (user) {
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

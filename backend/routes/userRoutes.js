const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const router = express.Router(); // Define the router

// POST: Register a new user
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            console.log('Registration failed: Missing fields');
            return res.status(400).json({ message: 'Please provide all fields' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            console.log('Registration failed: User already exists');
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        if (user) {
            console.log('User registered successfully:', user);
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
            });
        } else {
            console.log('Registration failed: Invalid user data');
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Error during registration:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST: Login a user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            console.log('Login failed: Missing email or password');
            return res.status(400).json({ message: 'Please provide both email and password' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('Login failed: User not found');
            return res.status(404).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Login failed: Invalid password');
            return res.status(404).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        console.log('User logged in successfully:', user);
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token,
        });
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

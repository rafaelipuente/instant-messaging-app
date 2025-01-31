const express = require('express');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Update user profile
router.put('/profile', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (user) {
        user.name = req.body.name || user.name;
        if (req.body.password) {
            user.password = req.body.password;
        }
        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            token: req.user.token, // Reuse the existing token
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

module.exports = router;

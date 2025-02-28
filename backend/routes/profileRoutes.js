const express = require('express');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Update user profile
router.put('/profile', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (user) {
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        user.bio = req.body.bio || user.bio;
        user.avatar = req.body.avatar || user.avatar;
        
        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            bio: updatedUser.bio,
            avatar: updatedUser.avatar,
            token: req.token
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

module.exports = router;

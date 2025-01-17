const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from header
            token = req.headers.authorization.split(' ')[1];

            console.log('Authorization Header:', req.headers.authorization);
            console.log('Extracted Token:', token); 

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Debugging: Log the decoded token payload
            console.log('Decoded Token:', decoded);

            // Attach user to request object
            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            console.error('Error decoding token:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };

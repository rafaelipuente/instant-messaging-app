/*****************************************************
 * authMiddleware.js 
 *****************************************************/
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // Extract token
      token = req.headers.authorization.split(' ')[1];
      console.log('Extracted Token:', token);

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Decoded Token:', decoded);

      // Make sure your payload sets decoded._id 
      // If your token uses 'id', swap to decoded.id instead
      const user = await User.findById(decoded._id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Attach user to request
      req.user = user;
      next();
    } else {
      res.status(401).json({ message: 'Not authorized, no token' });
    }
  } catch (error) {
    console.error('Error verifying token:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };

/*****************************************************
 * auth.js - Unified authentication middleware
 *****************************************************/
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

/**
 * Authentication middleware for API routes
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authentication token, access denied' });
    }

    // Check if it's a Bearer token
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Find user
      const user = await User.findById(decoded._id || decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Attach user to the request
      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ error: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

/**
 * Authentication middleware for Socket.IO connections
 * @param {object} socket - Socket.IO socket object
 * @param {function} next - Socket.IO next function
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }
    
    // Find user from token
    const user = await User.findById(decoded._id || decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
};

// For backward compatibility, provide multiple exports
module.exports = authenticate; // Default export for existing imports
module.exports.protect = authenticate; // Named export for code using protect
module.exports.socketAuth = socketAuth; // Socket authentication middleware

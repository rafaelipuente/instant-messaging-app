const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authentication token, access denied' });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      // Verify token
      const decoded = jwt.verify(token, 'your_jwt_secret');
      req.user = decoded;
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

module.exports = auth;

/*****************************************************
 * app.js
 *****************************************************/
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // added fs module

// 1. IMPORT ROUTES
const userRoutes = require('./routes/userRoutes');
const chatRoomRoutes = require('./routes/chatRoomRoutes'); 
const directMessageRoutes = require('./routes/directMessageRoutes');
const messageRoutes = require('./routes/messageRoutes');

// 2. CREATE EXPRESS APP
const app = express();

/*****************************************************
 * 3. MIDDLEWARE
 *****************************************************/
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],  // allow both ports
  credentials: true,
}));
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files (e.g. profile pictures) from "uploads" folder
app.use('/uploads', express.static(uploadsDir));

// Log all requests to /uploads for debugging
app.use('/uploads', (req, res, next) => {
  console.log('Profile picture request:', req.url);
  next();
});

/*****************************************************
 * 4. ATTACH ROUTES
 *****************************************************/
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoomRoutes);
app.use('/api/dm', directMessageRoutes);
app.use('/api/messages', messageRoutes);

/*****************************************************
 * 5. ERROR HANDLING
 *****************************************************/
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!'
  });
});

/*****************************************************
 * 6. EXPORT
 *****************************************************/
module.exports = app;

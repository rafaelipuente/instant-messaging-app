/*****************************************************
 * app.js
 *****************************************************/
const express = require('express');
const cors = require('cors');
const path = require('path');

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
  origin: ['http://localhost:3000', 'http://127.0.0.1:63498', 'http://127.0.0.1:60811'],  // adjusted for browser preview
  credentials: true,
}));
app.use(express.json());

// Serve static files (e.g. profile pictures) from "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

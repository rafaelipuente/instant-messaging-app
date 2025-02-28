# Simplified Instant Messaging App

A streamlined instant messaging app built with the MERN stack (MongoDB, Express, React, Node.js) focusing on code simplicity and maintainability.

## Features

- Unified messaging interface for both channels and direct messages
- Real-time communication with socket.io
- User presence and typing indicators
- Message deletion
- User profiles and avatars
- Simplified data models and component architecture

## Simplified Architecture

### Backend

The backend has been simplified through:

1. **Consolidated Data Models**:
   - Unified `Conversation` model that handles both channels and direct messages
   - Simplified `Message` model with improved indexing
   - Enhanced `User` model with better conversation tracking

2. **Streamlined Routes**:
   - Consistent API endpoints
   - Improved error handling
   - Better authorization checks

3. **Socket Improvements**:
   - Centralized message handling
   - Simplified event system
   - Better client notification

### Frontend

The frontend has been simplified through:

1. **Context-based State Management**:
   - `AuthContext` - User authentication and session management
   - `SocketContext` - Centralized socket communication
   - `MessageContext` - Message operations and state
   - `ConversationContext` - Channel and direct message conversations

2. **Component Consolidation**:
   - Unified `MessagingHub` component replacing separate channel and DM components
   - Reusable UI elements
   - Consistent styling

3. **Improved Code Organization**:
   - Better separation of concerns
   - Reduced code duplication
   - More consistent error handling

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   cd messageApp
   npm install
   cd frontend
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5001
   ```
4. Start the backend and frontend:
   ```
   # In the root directory
   npm run dev
   
   # In a separate terminal, in the frontend directory
   npm start
   ```

## Technologies Used

- **Frontend**: React, React Router, Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)

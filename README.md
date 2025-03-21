# Instant Messaging App

A real-time messaging application built with the MERN stack (MongoDB, Express, React, Node.js) that allows users to communicate instantly through direct messages and public channels.

![Instant Messaging App](https://user-images.githubusercontent.com/your-username/placeholder-image.png)

## Features

- **Real-time messaging**: Send and receive messages instantly
- **Direct messaging**: Private conversations between users
- **Public channels**: Join discussions in public channels
- **User status**: See when users are online or offline
- **Message deletion**: Delete sent messages with real-time updates
- **User authentication**: Secure login and registration
- **Profile customization**: Upload profile pictures and update your status
- **Typing indicators**: See when other users are typing
- **Responsive design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React.js (Create React App)
- Socket.IO Client for real-time communication
- React Router for navigation
- CSS for styling
- Context API for state management

### Backend
- Node.js
- Express.js
- Socket.IO for real-time event handling
- MongoDB for data storage
- Mongoose ODM
- JWT for authentication

## Installation

### Prerequisites

- Node.js (v14 or above)
- npm or yarn
- MongoDB (local installation or MongoDB Atlas account)

### Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/instant-messaging-app.git
cd instant-messaging-app
```

2. **Install backend dependencies**

```bash
cd backend
npm install
```

3. **Install frontend dependencies**

```bash
cd ../frontend
npm install
```

4. **Set up environment variables**

Create a `.env` file in the backend directory with the following variables:

```
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your_jwt_secret_here
PORT=5001
```

## Running the App Locally

1. **Start MongoDB**

If you're using a local MongoDB installation, make sure it's running:

```bash
mongod
```

2. **Start the backend server**

```bash
cd backend
npm start
```

The server will run on http://localhost:5001

3. **Start the frontend development server**

```bash
cd ../frontend
npm start
```

The application will open in your browser at http://localhost:3000

## Usage

1. **Register a new account** or log in with an existing account
2. **Navigate to the Chat section** to see public channels and direct messages
3. **Click on a channel** to join and start sending messages
4. **Click on a user** in the direct messages section to start a private conversation
5. **Hover over your own messages** to see the delete option
6. **View and edit your profile** by clicking on your username

## Troubleshooting

- If you encounter connection issues, make sure both backend and frontend servers are running
- Check that MongoDB is accessible at the URI specified in your .env file
- Ensure your browser supports WebSockets for real-time functionality
- Clear your browser cache if you experience unexpected behavior

## Running Tests

The application uses Jest as the testing framework for both frontend and backend.

### Backend Tests

To run backend tests:

```bash
cd backend
npm test
```

This will run all tests in the `__tests__` directory, including:
- Unit tests for user authentication (registration and login)
- Integration tests for message deletion functionality
- Utility tests for database operations

### Frontend Tests

To run frontend tests:

```bash
cd frontend
npm test
```

This will run React component tests using React Testing Library.

### Test Coverage

To generate test coverage reports:

```bash
cd backend
npm test -- --coverage
```

This will show you how much of your codebase is covered by tests.

## Alternative Version

- https://github.com/rafaelipuente/instant-messaging-app/tree/feature/message-deletion-fix (Warning: may contain experimental features and bugs)
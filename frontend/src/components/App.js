import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Home from '../pages/Home';
import Register from '../pages/Register';
import Login from '../pages/Login';
import Chat from './Chat';
import { isTokenValid, logout } from '../utils/auth';
import '../styles/global.css';

/**
 * ProtectedRoute:
 * A wrapper to ensure only authenticated users (valid token) can access certain routes.
 * If token is invalid/expired, logs out and redirects to /login.
 */
const ProtectedRoute = ({ children }) => {
  if (!isTokenValid()) {
    logout();
    return <Navigate to="/login" />;
  }
  return children;
};

const App = () => {
  // Periodically check token validity; if expired, log out and redirect.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTokenValid()) {
        logout();
        window.location.href = '/login'; 
      }
    }, 60000); // every 60 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      {/* Navbar persists across all pages */}
      <Navbar />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Protected route: Chat */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Router>
  );
};

export default App;

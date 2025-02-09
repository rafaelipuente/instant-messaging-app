import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Chat from './Chat';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Profile from './Profile'; // Import Profile component
import '../styles/App.css';

const App = () => {
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false); // Add state for showProfile

  const handleLogout = () => {
    logout();
  };

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/">Chat App</Link>
          </div>
          <div className="nav-links">
            {user ? (
              <>
                <Link to="/chat" className="nav-link">Chat</Link>
                <button onClick={handleLogout} className="logout-button">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/register" className="nav-link">Register</Link>
              </>
            )}
          </div>
        </nav>

        <Routes>
          <Route path="/login" element={user ? <Navigate to="/chat" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/chat" /> : <Register />} />
          <Route
            path="/chat"
            element={
              user ? (
                <PrivateRoute>
                  <div className="app-header">
                    <h1>Chat App</h1>
                    <div className="header-actions">
                      <button className="profile-button" onClick={() => setShowProfile(true)}>Profile</button>
                      <button className="settings-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <Chat />
                  {showProfile && <Profile isOpen={showProfile} onClose={() => setShowProfile(false)} />}
                </PrivateRoute>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/" element={<Navigate to={user ? "/chat" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
};

// Add PrivateRoute component
const PrivateRoute = ({ children }) => {
  return children;
};

export default App;

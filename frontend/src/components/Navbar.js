import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { isTokenValid, logout } from '../utils/auth';
import '../styles/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = isTokenValid();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // e.g., highlight which route we're on, or show/hide certain links
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">MessagingApp</Link>
      </div>
      <div className="navbar-links">
        {location.pathname !== '/chat' && (
          <>
            <Link to="/">Home</Link>
            {!loggedIn && <Link to="/login">Login</Link>}
            {!loggedIn && <Link to="/register">Register</Link>}
            {loggedIn && <Link to="/chat">Chat</Link>}
          </>
        )}
        {location.pathname === '/chat' && (
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

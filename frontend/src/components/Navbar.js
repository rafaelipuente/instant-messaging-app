import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-logo">
          Chat App
        </Link>
      </div>
      
      {user ? (
        <div className="navbar-menu">
          <span className="navbar-username">
            Welcome, {user.name}
          </span>
          <Link to="/profile" className="navbar-link">
            Profile
          </Link>
          <button onClick={handleLogout} className="navbar-button logout">
            Logout
          </button>
        </div>
      ) : (
        <div className="navbar-menu">
          <Link to="/login" className="navbar-link">
            Login
          </Link>
          <Link to="/register" className="navbar-link">
            Register
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const user = localStorage.getItem('authUser');
    if (user) {
      setIsLoggedIn(true);
      setUsername(JSON.parse(user).name);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authUser');
    setIsLoggedIn(false);
    setUsername('');
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">💬</span>
          <span className="brand-text">MessagingApp</span>
        </Link>

        {/* Mobile menu button */}
        <button 
          className={`mobile-menu-button ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className="menu-icon"></span>
        </button>

        {/* Navigation links */}
        <div className={`navbar-links ${isMenuOpen ? 'active' : ''}`}>
          <Link 
            to="/" 
            className={`nav-link ${isActive('/')}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Home</span>
          </Link>
          
          {isLoggedIn ? (
            <>
              <Link 
                to="/chat" 
                className={`nav-link ${isActive('/chat')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">💭</span>
                <span className="nav-text">Chat</span>
              </Link>

              <div className="user-menu" onMouseEnter={() => setIsMenuOpen(true)} onMouseLeave={() => setIsMenuOpen(false)}>
                <button className="user-button">
                  <span className="nav-icon">👤</span>
                  <span className="nav-text">{username}</span>
                </button>
                
                {isMenuOpen && (
                  <div className="dropdown-menu">
                    <Link to="/profile" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <span className="dropdown-icon">⚙️</span>
                      Edit Profile
                    </Link>
                    <button onClick={handleLogout} className="dropdown-item">
                      <span className="dropdown-icon">🚪</span>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className={`nav-link ${isActive('/login')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">🔑</span>
                <span className="nav-text">Login</span>
              </Link>
              <Link 
                to="/register" 
                className={`nav-link ${isActive('/register')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">✨</span>
                <span className="nav-text">Register</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

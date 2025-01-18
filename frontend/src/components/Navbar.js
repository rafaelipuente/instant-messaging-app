import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-logo">
                    MessagingApp
                </Link>
                <ul className="navbar-links">
                    <li>
                        <Link to="/" className="navbar-item">Home</Link>
                    </li>
                    <li>
                        <Link to="/login" className="navbar-item">Login</Link>
                    </li>
                    <li>
                        <Link to="/register" className="navbar-item">Register</Link>
                    </li>
                    <li>
                        <Link to="/chat" className="navbar-item">Chat</Link>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;

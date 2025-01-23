import React from 'react';
import { Link } from 'react-router-dom';
import { isTokenValid, logout } from '../utils/auth';
import '../styles/Navbar.css';


const Navbar = () => {
    const loggedIn = isTokenValid();

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <Link to="/">MessagingApp</Link>
            </div>
            <div className="navbar-links">
                <Link to="/">Home</Link>
                {loggedIn ? (
                    <>
                        <Link to="/chat">Chat</Link>
                        <button className="logout-button" onClick={handleLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;

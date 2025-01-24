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

    // Check if we're on the chat page
    const isChatPage = location.pathname === '/chat';

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <Link to="/">MessagingApp</Link>
            </div>
            <div className="navbar-links">
                {isChatPage ? (
                    <button className="logout-button" onClick={handleLogout}>
                        Logout
                    </button>
                ) : (
                    <>
                        <Link to="/">Home</Link>
                        {loggedIn ? (
                            <Link to="/chat">Chat</Link>
                        ) : (
                            <>
                                <Link to="/login">Login</Link>
                                <Link to="/register">Register</Link>
                            </>
                        )}
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
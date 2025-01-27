import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <nav className="flex justify-between items-center p-4 bg-gray-800 text-white">
            <h1 className="text-xl font-bold">Instant Messaging App</h1>
            <div className="flex gap-4">
                <Link to="/" className="hover:text-gray-300">Home</Link>
                <Link to="/register" className="hover:text-gray-300">Register</Link>
                <Link to="/login" className="hover:text-gray-300">Login</Link>
                <Link to="/chat" className="hover:text-gray-300">Chat</Link>
            </div>
        </nav>
    );
};

export default Navbar;

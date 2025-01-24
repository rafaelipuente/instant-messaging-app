import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Home from '../pages/Home';
import Register from '../pages/Register';
import Login from '../pages/Login';
import Chat from './Chat';
import { isTokenValid, logout } from '../utils/auth';
import '../styles/global.css';

const ProtectedRoute = ({ children }) => {
    if (!isTokenValid()) {
        logout();
        return <Navigate to="/login" />;
    }

    return children;
};

const App = () => {
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isTokenValid()) {
                logout();
                window.location.href = '/login'; // Redirect to login on token expiration
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <Chat />
                        </ProtectedRoute>
                    }
                />
                {/* 404 Error Page */}
                <Route path="*" element={<h1>404 - Page Not Found</h1>} />
            </Routes>
        </Router>
    );
};

export default App;
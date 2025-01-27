import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar'; // Navigation bar
import Home from './pages/Home'; // Home page
import Register from './components/Register'; // Register component
import Login from './components/Login'; // Login component
import Chat from './components/Chat'; // Chat component
import { isTokenValid } from './utils/auth'; // Utility to validate token

const App = () => {
    return (
        <Router>
            {/* Navbar is globally available */}
            <Navbar />
            <Routes>
                {/* Home Route */}
                <Route path="/" element={<Home />} />
                
                {/* Register Route */}
                <Route path="/register" element={<Register />} />
                
                {/* Login Route */}
                <Route path="/login" element={<Login />} />
                
                {/* Chat Route (Protected Route Example) */}
                <Route
                    path="/chat"
                    element={
                        isTokenValid() ? <Chat /> : <Navigate to="/login" replace />
                    }
                />
                
                {/* 404 Error Route */}
                <Route path="*" element={<h1>404 - Page Not Found</h1>} />
            </Routes>
        </Router>
    );
};

export default App;

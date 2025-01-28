import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Home from '../pages/Home';
import Register from '../pages/Register';
import Login from '../pages/Login';
import Chat from './Chat';
import { isTokenValid, logout } from '../utils/auth';

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
        window.location.href = '/login';
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1">
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
            <Route path="*" element={<h1>404 - Page Not Found</h1>} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
};

export default App;

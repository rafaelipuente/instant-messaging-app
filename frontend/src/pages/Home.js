import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Welcome to MessagingApp</h1>
        <p className="home-description">
          Connect with your friends and colleagues instantly. Use the navigation bar to explore features such as chat rooms, login, and registration.
        </p>
        <div className="home-buttons">
          <Link to="/register" className="home-button register">
            Register
          </Link>
          <Link to="/login" className="home-button login">
            Login
          </Link>
        </div>
        <div className="home-features">
          <div className="feature-card">
            <h3>Real-time Chat</h3>
            <p>Instant messaging with friends and colleagues</p>
          </div>
          <div className="feature-card">
            <h3>User Profiles</h3>
            <p>Customize your profile and connect with others</p>
          </div>
          <div className="feature-card">
            <h3>Secure</h3>
            <p>Your messages are private and secure</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

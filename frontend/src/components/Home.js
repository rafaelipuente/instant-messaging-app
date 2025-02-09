import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Welcome to Chat App</h1>
        <p>Connect with friends instantly</p>
        
        <div className="home-buttons">
          {user ? (
            <Link to="/chat" className="home-button primary">
              Go to Chat
            </Link>
          ) : (
            <>
              <Link to="/login" className="home-button primary">
                Login
              </Link>
              <Link to="/register" className="home-button secondary">
                Register
              </Link>
            </>
          )}
        </div>

        <div className="features">
          <div className="feature">
            <h3>Real-time Chat</h3>
            <p>Instant messaging with friends</p>
          </div>
          <div className="feature">
            <h3>Simple & Fast</h3>
            <p>Easy to use interface</p>
          </div>
          <div className="feature">
            <h3>Secure</h3>
            <p>Your messages are protected</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

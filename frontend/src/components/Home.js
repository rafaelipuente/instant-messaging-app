import React from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle, FiLock, FiUsers, FiGlobe, FiArrowRight } from 'react-icons/fi';
import '../styles/Home.css';

const Home = () => {
  const isLoggedIn = localStorage.getItem('authUser');

  return (
    <div className="home-container">
      <div className="hero-section">
        <div className="hero-content">
          <div className="brand-tag">👋 Welcome to MessagingApp</div>
          <h1 className="hero-title">
            Connect with friends in
            <span className="highlight"> real-time</span>
          </h1>
          <p className="hero-subtitle">
            Experience seamless communication with our modern messaging platform. 
            Join thousands of users who trust MessagingApp for their daily conversations.
          </p>
          <div className="cta-buttons">
            {!isLoggedIn ? (
              <>
                <Link to="/register" className="cta-button primary">
                  Get Started <FiArrowRight className="button-icon" />
                </Link>
                <Link to="/login" className="cta-button secondary">
                  Sign In
                </Link>
              </>
            ) : (
              <Link to="/chat" className="cta-button primary">
                Go to Chat <FiArrowRight className="button-icon" />
              </Link>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">10k+</span>
              <span className="stat-label">Active Users</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">99.9%</span>
              <span className="stat-label">Uptime</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">Support</span>
            </div>
          </div>
        </div>
        <div className="hero-image">
          <div className="chat-preview">
            <div className="chat-header">
              <div className="chat-avatar">
                <span className="avatar-status online"></span>
              </div>
              <div className="chat-info">
                <span className="chat-name">Team Chat</span>
                <span className="chat-status">3 members active</span>
              </div>
            </div>
            <div className="chat-messages">
              <div className="preview-message received">
                <span>Hey team! How's the project going? 🚀</span>
                <div className="message-time">10:30 AM</div>
              </div>
              <div className="preview-message sent">
                <span>Making great progress! Just finished the new features 💪</span>
                <div className="message-time">10:31 AM</div>
              </div>
              <div className="preview-message received">
                <span>That's awesome! Let's review it together 🎯</span>
                <div className="message-time">10:32 AM</div>
              </div>
            </div>
            <div className="chat-input">
              <input type="text" placeholder="Type a message..." disabled />
              <button className="send-button" disabled>Send</button>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <div className="section-header">
          <h2>Why choose MessagingApp?</h2>
          <p className="section-subtitle">Everything you need for seamless communication</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <FiMessageCircle />
            </div>
            <h3>Real-time Chat</h3>
            <p>Experience instant messaging with zero delay. Stay connected with your team and friends in real-time.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <FiLock />
            </div>
            <h3>Secure & Private</h3>
            <p>Your conversations are protected with end-to-end encryption. Your privacy is our top priority.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <FiUsers />
            </div>
            <h3>Team Collaboration</h3>
            <p>Create group chats, share files, and collaborate effectively with your team members.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <FiGlobe />
            </div>
            <h3>Available Everywhere</h3>
            <p>Access your messages from any device, anywhere. Stay connected on the go.</p>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="cta-content">
          <h2>Ready to get started?</h2>
          <p>Join thousands of users who trust MessagingApp for their daily conversations.</p>
          {!isLoggedIn && (
            <Link to="/register" className="cta-button primary">
              Create Free Account <FiArrowRight className="button-icon" />
            </Link>
          )}
        </div>
      </div>

      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>MessagingApp</h3>
            <p>Modern messaging for everyone</p>
          </div>
          <div className="footer-links">
            <div className="footer-section">
              <h4>Product</h4>
              <Link to="/features">Features</Link>
              <Link to="/security">Security</Link>
              <Link to="/team">Team</Link>
            </div>
            <div className="footer-section">
              <h4>Company</h4>
              <Link to="/about">About</Link>
              <Link to="/careers">Careers</Link>
              <Link to="/contact">Contact</Link>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/cookies">Cookies</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p> 2025 MessagingApp. All rights reserved.</p>
          <p>Built with by Rafael</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;

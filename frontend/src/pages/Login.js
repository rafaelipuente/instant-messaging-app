import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear any previous errors

    try {
      // Call the login API endpoint
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        // Handle invalid login
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to log in');
      }

      const data = await response.json();

      // Store token in localStorage
      localStorage.setItem('authUser', JSON.stringify(data));

      // Redirect to the chat page
      navigate('/chat');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          {error && <p className="error-message">{error}</p>}
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <button type="submit" className="btn-submit">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css'; // Reusing the same styles as Login

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Call the register API endpoint
      const response = await fetch('http://localhost:5000/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        // Handle registration error
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to register');
      }

      // Redirect to login after successful registration
      alert('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
          {error && <p className="error-message">{error}</p>}

          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            required
          />

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
            Register
          </button>
        </form>

        {/* Add link to login */}
        <p className="redirect-message">
          Already have an account? <a href="/login">Log in here</a>.
        </p>
      </div>
    </div>
  );
};

export default Register;

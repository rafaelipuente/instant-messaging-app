import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axios';
import '../styles/Profile.css';

const Profile = () => {
  const { authUser, updateAuthUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
    socialMedia: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (authUser) {
      setFormData({
        username: authUser.name || '',
        email: authUser.email || '',
        bio: authUser.bio || '',
        socialMedia: authUser.socialMedia || ''
      });
    }
  }, [authUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await axiosInstance.put('/users/profile', formData);
      if (response.data) {
        updateAuthUser(response.data);
        setSuccessMessage('Profile updated successfully!');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!authUser) {
    return (
      <div className="page-container">
        <div className="content-card">
          <div className="error-message">Please log in to view your profile.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="content-card">
        <h1>Profile Settings</h1>
        
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows="4"
              disabled={isLoading}
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="socialMedia">Social Media URL</label>
            <input
              type="url"
              id="socialMedia"
              name="socialMedia"
              value={formData.socialMedia}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="https://twitter.com/yourusername"
            />
          </div>

          <button
            type="submit"
            className="update-button"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;

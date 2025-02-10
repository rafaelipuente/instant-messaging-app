import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import Navbar from './Navbar';
import '../styles/Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    status: user?.status || 'online'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(
    user?.profilePicture ? 
    (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE_URL.replace('/api', '')}${user.profilePicture}`) : 
    null
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('username', formData.username);
      formDataToSend.append('status', formData.status);

      if (selectedFile) {
        formDataToSend.append('profilePicture', selectedFile);
      }

      const response = await axios.put(
        `${API_BASE_URL}/users/profile`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'multipart/form-data'
          },
          withCredentials: true
        }
      );

      const updatedUser = response.data;
      
      // Update the user in context
      updateUser({
        ...updatedUser,
        token: updatedUser.token || user.token
      });

      // Update preview URL
      if (updatedUser.profilePicture) {
        const fullUrl = updatedUser.profilePicture.startsWith('http') ? 
          updatedUser.profilePicture : 
          `${API_BASE_URL.replace('/api', '')}${updatedUser.profilePicture}`;
        setPreviewUrl(fullUrl);
      }

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Failed to update profile';
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      username: user?.username || '',
      status: user?.status || 'online'
    });
    setSelectedFile(null);
    setPreviewUrl(
      user?.profilePicture ? 
      (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE_URL.replace('/api', '')}${user.profilePicture}`) : 
      null
    );
    setError('');
    setIsEditing(false);
  };

  return (
    <div className="page-container">
      <Navbar />
      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-header-left">
              <div className="profile-title-group">
                <h2>Profile</h2>
                <div className="status-badge">
                  <span className={`status-dot ${formData.status}`}></span>
                  {formData.status}
                </div>
              </div>
            </div>
            <div className="profile-header-right">
              <button 
                className="back-button"
                onClick={() => navigate('/chat')}
              >
                <span>←</span>
                Back to Chat
              </button>
              <button 
                className="edit-button"
                onClick={() => {
                  if (isEditing) {
                    handleCancel();
                  } else {
                    setIsEditing(true);
                  }
                }}
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          <div className="profile-picture-section">
            <div className="profile-picture-container">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Profile" 
                  className="profile-picture"
                  onError={() => setPreviewUrl(null)}
                />
              ) : (
                <div className="profile-picture-placeholder">
                  {formData.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {isEditing && (
                <label className="profile-picture-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <span className="upload-icon">📸</span>
                </label>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={!isEditing}
              >
                <option value="online">Online</option>
                <option value="away">Away</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {isEditing && (
              <button type="submit" className="save-button">
                Save Changes
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

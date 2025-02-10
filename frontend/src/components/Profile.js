import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  const [uploadError, setUploadError] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setUploadError('File size must be less than 5MB');
        return;
      }
      if (!file.type.match('image.*')) {
        setUploadError('Please select an image file');
        return;
      }
      setSelectedFile(file);
      setUploadError(null);

      // Show preview of selected image
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = document.querySelector('.profile-image');
        if (preview) {
          preview.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    try {
      if (!selectedFile) {
        setUploadError('Please select a file');
        return;
      }

      console.log('=== Starting Upload ===');
      console.log('Current user:', user);

      const token = user?.token;
      if (!token) {
        console.error('No token found in user object:', user);
        setUploadError('Authentication error. Please log in again.');
        navigate('/login');
        return;
      }

      // Log the file details
      console.log('=== File Details ===');
      console.log({
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        lastModified: new Date(selectedFile.lastModified).toISOString()
      });

      const formData = new FormData();
      formData.append('profilePicture', selectedFile);

      // Log the request details
      console.log('=== Request Details ===');
      console.log('URL:', 'http://localhost:5001/api/users/upload-profile-picture');
      console.log('Token:', token);

      const response = await axios.post(
        'http://localhost:5001/api/users/upload-profile-picture',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      console.log('=== Response Details ===');
      console.log('Status:', response.status);
      console.log('Data:', response.data);

      if (response.data && response.data.profilePicture) {
        const updatedUser = { 
          ...user, 
          profilePicture: response.data.profilePicture 
        };
        console.log('=== Updating User ===');
        console.log('New user data:', updatedUser);
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        updateUser(updatedUser);
        setSelectedFile(null);
        setUploadError(null);
      } else {
        console.error('Invalid response format:', response.data);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('=== Upload Error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      console.error('Response headers:', error.response?.headers);
      
      if (error.response?.status === 401) {
        setUploadError('Session expired. Please log in again.');
        navigate('/login');
      } else {
        const errorMessage = 
          error.response?.data?.error || 
          error.response?.data?.message || 
          error.message || 
          'Error uploading file';
        
        console.error('Setting error message:', errorMessage);
        setUploadError(errorMessage);
      }
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
    try {
      // Save the status in localStorage for immediate UI update
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const updatedUser = { ...currentUser, status: formData.status };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Force a page reload to reflect the changes
      window.location.reload();
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handleBackToChat = () => {
    navigate('/chat');
  };

  return (
    <div className="profile-container">
      <Navbar />
      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-header-left">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar">
                  {(user?.profilePicture || selectedFile) ? (
                    <img 
                      src={selectedFile ? URL.createObjectURL(selectedFile) : `http://localhost:5001${user.profilePicture}`}
                      alt="Profile" 
                      className="profile-image"
                    />
                  ) : (
                    <span>{user?.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {!isEditing && (
                  <div className="profile-picture-controls">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="file-input"
                      id="profile-picture-input"
                    />
                    <label htmlFor="profile-picture-input" className="file-input-label">
                      Choose Picture
                    </label>
                    {selectedFile && (
                      <button onClick={handleUpload} className="btn-upload">
                        Upload
                      </button>
                    )}
                    {uploadError && (
                      <div className="upload-error">
                        {uploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <h1>Profile</h1>
                <div className={`status-badge ${user?.status || 'online'}`}>
                  {user?.status || 'Online'}
                </div>
              </div>
            </div>
            <button onClick={handleBackToChat} className="btn-back">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to Chat
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="form-input"
                  disabled
                />
                <small>Username cannot be changed</small>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="profile-actions">
                <button type="submit" className="btn-save">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user?.name || '',
                      username: user?.username || '',
                      status: user?.status || 'online'
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <div className="info-group">
                <label>Name</label>
                <p>{user?.name}</p>
              </div>

              <div className="info-group">
                <label>Username</label>
                <p>{user?.username}</p>
              </div>

              <div className="info-group">
                <label>Status</label>
                <p className={`status-badge ${user?.status || 'online'}`}>
                  {user?.status || 'Online'}
                </p>
              </div>

              <div className="profile-actions">
                <button
                  className="btn-edit"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

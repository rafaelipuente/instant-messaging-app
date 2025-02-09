import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Profile.css';

const Profile = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
    twitter: '',
    github: '',
    linkedin: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
        twitter: user.twitter || '',
        github: user.github || '',
        linkedin: user.linkedin || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`http://localhost:5001/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      updateUser(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal">
      <div className="profile-content">
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Profile</h2>
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              disabled={!isEditing}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Twitter</label>
            <input
              type="url"
              name="twitter"
              value={formData.twitter}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="https://twitter.com/username"
            />
          </div>

          <div className="form-group">
            <label>GitHub</label>
            <input
              type="url"
              name="github"
              value={formData.github}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="https://github.com/username"
            />
          </div>

          <div className="form-group">
            <label>LinkedIn</label>
            <input
              type="url"
              name="linkedin"
              value={formData.linkedin}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <div className="profile-actions">
            {!isEditing ? (
              <button
                type="button"
                className="edit-button"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button type="submit" className="save-button">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      username: user.username || '',
                      email: user.email || '',
                      bio: user.bio || '',
                      twitter: user.twitter || '',
                      github: user.github || '',
                      linkedin: user.linkedin || ''
                    });
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

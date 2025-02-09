import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/UserProfile.css';

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const { username } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${username}`);
        if (response.data) {
          setProfile(response.data);
        } else {
          setError('User profile not found');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err.response?.data?.error || 'Failed to load user profile');
      }
    };

    if (username) {
      fetchProfile();
    }
  }, [username]);

  const handleBack = () => {
    navigate('/chat');
  };

  if (error) {
    return (
      <div className="profile-container error">
        <div className="error-message">{error}</div>
        <button onClick={handleBack}>Back to Chat</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-info">
        <h2>{profile.name}'s Profile</h2>
        <div className="info-row">
          <span className="label">Username:</span>
          <span>{profile.username}</span>
        </div>
        <div className="info-row">
          <span className="label">Email:</span>
          <span>{profile.email}</span>
        </div>
        {profile.bio && (
          <div className="info-row">
            <span className="label">Bio:</span>
            <span>{profile.bio}</span>
          </div>
        )}
        {profile.socialLink && (
          <div className="info-row">
            <span className="label">Social Link:</span>
            <a href={profile.socialLink} target="_blank" rel="noopener noreferrer">
              {profile.socialLink}
            </a>
          </div>
        )}
        <button onClick={handleBack}>Back to Chat</button>
      </div>
    </div>
  );
};

export default UserProfile;

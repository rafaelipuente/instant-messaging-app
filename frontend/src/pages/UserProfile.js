import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../api/axios';
import '../styles/Profile.css';

const UserProfile = () => {
  const { username } = useParams();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axiosInstance.get(`/users/profile/${username}`);
        setUserData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [username]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="content-card">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="content-card">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="page-container">
        <div className="content-card">
          <div className="error-message">User not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="content-card">
        <h1>User Profile</h1>
        <div className="profile-info">
          <div className="profile-field">
            <label>Username</label>
            <p>{userData.name}</p>
          </div>

          <div className="profile-field">
            <label>Email</label>
            <p>{userData.email}</p>
          </div>

          {userData.bio && (
            <div className="profile-field">
              <label>Bio</label>
              <p>{userData.bio}</p>
            </div>
          )}

          {userData.socialMedia && (
            <div className="profile-field">
              <label>Social Media</label>
              <p>
                <a 
                  href={userData.socialMedia} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  {userData.socialMedia}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;

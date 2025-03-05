import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserAvatar from './UserAvatar';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import '../styles/UserProfilePreview.css';

// Helper function to format the ID for MongoDB
const formatUserId = (id) => {
  if (!id) return null;
  // Remove any colons that might be in the ID
  return id.toString().replace(/[:]/g, '');
};

const UserProfilePreview = ({ userId, username, profilePicture, position = { top: 0, left: 0 } }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = useAuth();

  // Simulated user data when we can't fetch from API
  const createSimulatedUserData = () => {
    return {
      _id: userId,
      username: username || 'Unknown User',
      profilePicture: profilePicture,
      status: 'online',
      bio: 'No additional information available',
      email: null,
      joinedAt: new Date().toISOString()
    };
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) {
        setError('No user ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Format the user ID
        const formattedId = formatUserId(userId);
        console.log(`Fetching user data for ID: ${formattedId}`);
        
        // Use the token from the Auth context or from localStorage
        const storedUser = localStorage.getItem('user');
        let authToken = auth.token;
        
        if (!authToken && storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            authToken = parsedUser.token;
          } catch (e) {
            console.error('Failed to parse stored user:', e);
          }
        }
        
        if (!authToken) {
          console.warn('No token available, using simulated user data');
          setUserData(createSimulatedUserData());
          setLoading(false);
          return;
        }
        
        const response = await axios.get(`${API_BASE_URL}/users/${formattedId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data) {
          console.log('User data fetched successfully:', response.data);
          setUserData(response.data);
          setLoading(false);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        console.error('Error details:', err.response ? err.response.data : 'No response data');
        
        // Fall back to simulated data on error
        console.log('Using simulated user data as fallback');
        setUserData(createSimulatedUserData());
        setError(null); // Clear error since we have fallback data
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, auth, username, profilePicture]);

  if (loading) {
    return (
      <div className="user-profile-preview" style={position}>
        <div className="loading-preview">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-profile-preview" style={position}>
        <div className="error-preview">{error}</div>
      </div>
    );
  }

  // Use provided data or fetched data
  const displayData = userData || { username, profilePicture };

  return (
    <div className="user-profile-preview" style={position}>
      <div className="preview-header">
        <UserAvatar 
          profilePicture={displayData.profilePicture} 
          username={displayData.username} 
          status={displayData.status || 'offline'} 
          className="preview-avatar"
        />
        <h3>{displayData.username}</h3>
      </div>
      
      <div className="preview-details">
        {displayData.status && (
          <div className="preview-status">
            <span className={`status-indicator ${displayData.status}`}></span>
            <span>{displayData.status.charAt(0).toUpperCase() + displayData.status.slice(1)}</span>
          </div>
        )}
        
        {displayData.bio && (
          <div className="preview-bio">
            <p>{displayData.bio}</p>
          </div>
        )}
        
        {displayData.joinedDate && (
          <div className="preview-joined">
            <span>Joined: {new Date(displayData.joinedDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="preview-actions">
        <button className="action-button message-button">Message</button>
      </div>
    </div>
  );
};

export default UserProfilePreview;

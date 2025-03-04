import React, { useState, useEffect } from 'react';

const getInitials = (username) => {
  if (!username) return '?';
  return username.charAt(0).toUpperCase();
};

const getRandomColor = (username) => {
  const colors = [
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
    '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
    '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
    '#d35400', '#c0392b', '#7f8c8d'
  ];
  
  const index = username?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
  return colors[index % colors.length];
};

const UserAvatar = ({ profilePicture, username, status = 'offline', className = '', onError }) => {
  const [showDefault, setShowDefault] = useState(!profilePicture);
  const initials = getInitials(username);
  const backgroundColor = getRandomColor(username);

  useEffect(() => {
    if (profilePicture) {
      const img = new Image();
      img.src = profilePicture;
      img.onload = () => setShowDefault(false);
      img.onerror = () => {
        setShowDefault(true);
        if (onError) onError(profilePicture);
      };
    } else {
      setShowDefault(true);
    }
  }, [profilePicture, onError]);

  return (
    <div className={`avatar-container ${className}`} style={{ borderRadius: '50%', overflow: 'hidden' }}>
      {showDefault ? (
        <div 
          className="default-avatar"
          style={{
            backgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
            position: 'absolute',
            top: '0',
            left: '2px',
            transform: 'translateX(-1px)'
          }}
        >
          {initials}
        </div>
      ) : (
        <img 
          src={profilePicture}
          alt={username || 'User'}
          className="user-avatar"
          style={{
            width: '40px',
            height: '40px',
            display: 'block',
            objectFit: 'cover',
            position: 'absolute',
            top: '0',
            left: '2px', /* Shift slightly to the right */
            transform: 'translateX(-1px)' /* Fine-tune position */
          }}
          onError={(e) => {
            setShowDefault(true);
            if (onError) onError(profilePicture);
          }}
        />
      )}
      <span className={`status-indicator ${status}`} />
    </div>
  );
};

export default UserAvatar;

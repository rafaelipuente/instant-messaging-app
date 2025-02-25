import React from 'react';

const getInitials = (username) => {
  if (!username) return '?';
  return username
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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

const UserAvatar = ({ profilePicture, username, className = '', onError }) => {
  const [showDefault, setShowDefault] = React.useState(!profilePicture);
  const initials = getInitials(username);
  const backgroundColor = getRandomColor(username);

  if (showDefault) {
    return (
      <div 
        className={`default-avatar ${className}`}
        style={{
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '500',
          fontSize: '14px',
          width: '100%',
          height: '100%',
          borderRadius: '50%'
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={profilePicture}
      alt={username}
      className={className}
      onError={() => setShowDefault(true)}
    />
  );
};

export default UserAvatar;

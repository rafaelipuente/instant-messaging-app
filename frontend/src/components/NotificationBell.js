import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/NotificationBell.css';

const NotificationBell = () => {
  const { notifications, markNotificationAsRead, clearNotifications, unreadMessages } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Calculate total unread notifications
  const unreadCount = notifications.filter(notif => !notif.read).length + 
    Object.values(unreadMessages).reduce((acc, messages) => acc + messages.length, 0);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (notification) => {
    markNotificationAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'directMessage') {
      navigate(`/chat?userId=${notification.senderId}`);
    } else if (notification.type === 'channelMessage') {
      navigate(`/chat?channel=${notification.channel}`);
    }
    
    setIsOpen(false);
  };

  const handleClearAll = () => {
    clearNotifications();
    setIsOpen(false);
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className="notification-bell" 
        onClick={toggleDropdown}
        aria-label="Notifications"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <button className="clear-all" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-avatar">
                    {notification.senderAvatar ? (
                      <img src={notification.senderAvatar} alt={notification.sender} />
                    ) : (
                      <div className="default-avatar">{notification.sender?.charAt(0)?.toUpperCase()}</div>
                    )}
                  </div>
                  <div className="notification-content">
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {formatTime(notification.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-notifications">
                <p>No new notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format timestamp
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export default NotificationBell;

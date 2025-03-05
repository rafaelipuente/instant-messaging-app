import React, { useState, useRef, useEffect } from 'react';
import UserProfilePreview from './UserProfilePreview';
import '../styles/UserNameWithPreview.css';

// Constants for the preview context
const PREVIEW_CONTEXT = {
  MESSAGE: 'message',    // Allow preview in message context
  USER_LIST: 'user_list', // No preview in user list
  NONE: 'none'           // No preview at all
};

const UserNameWithPreview = ({ userId, username, profilePicture, className = '', previewContext = PREVIEW_CONTEXT.NONE }) => {
  // Only enable preview for message context
  const isPreviewEnabled = previewContext === PREVIEW_CONTEXT.MESSAGE;
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const nameRef = useRef(null);
  const previewRef = useRef(null);
  const timeoutRef = useRef(null);
  const hoverTimeoutMs = 300; // Delay before showing preview

  // Calculate the position of the preview
  const calculatePosition = () => {
    if (!nameRef.current) return;
    
    const rect = nameRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default position would be below and to the right of the username
    let top = rect.bottom + scrollTop + 5; // 5px below the username
    let left = rect.left + scrollLeft;
    
    // Check if the preview would go off the right edge of the screen
    if (left + 280 > viewportWidth) { // 280px is the width of the preview
      left = viewportWidth - 290; // 10px margin from the right edge
    }
    
    // Check if the preview would go off the bottom of the screen
    // Assume preview height is about 200px
    if (top + 200 > viewportHeight + scrollTop) {
      // Place it above the username instead
      top = rect.top + scrollTop - 210; // 210px is preview height + 10px margin
    }
    
    setPreviewPosition({ top, left });
  };

  // Handle hover over username
  const handleMouseEnter = () => {
    // Only proceed if preview is enabled
    if (!isPreviewEnabled) return;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a timeout to show the preview after a delay
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setShowPreview(true);
    }, hoverTimeoutMs);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    // Clear timeout if mouse leaves before preview is shown
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Hide preview
    setShowPreview(false);
  };

  // Handle click on document to close the preview
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (previewRef.current && !previewRef.current.contains(event.target) &&
          nameRef.current && !nameRef.current.contains(event.target)) {
        setShowPreview(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <span className="username-with-preview">
      <span 
        ref={nameRef}
        className={`username-hover ${isPreviewEnabled ? 'preview-enabled' : ''} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          // Log the user ID to help debug
          if (isPreviewEnabled) {
            console.log('Clicked on username with ID:', userId);
          }
        }}
      >
        {username}
      </span>
      
      {isPreviewEnabled && showPreview && (
        <div 
          ref={previewRef}
          onMouseEnter={() => {
            // When mouse enters the preview, clear the timeout and keep it open
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          <UserProfilePreview 
            userId={userId}
            username={username}
            profilePicture={profilePicture}
            position={{
              top: `${previewPosition.top}px`,
              left: `${previewPosition.left}px`
            }}
          />
        </div>
      )}
    </span>
  );
};

// Export the component and the constants
UserNameWithPreview.PREVIEW_CONTEXT = PREVIEW_CONTEXT;
export default UserNameWithPreview;

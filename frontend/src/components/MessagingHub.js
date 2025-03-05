import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useMessages } from '../context/MessageContext';
import { useConversations } from '../context/ConversationContext';
import UserAvatar from './UserAvatar';
import UserNameWithPreview from './UserNameWithPreview';
import Navbar from './Navbar';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';
import '../styles/Chat.css';
import '../styles/DirectMessages.css';
import '../styles/MessagingHub.css';

const MessagingHub = () => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeToggle, setActiveToggle] = useState('channels');
  const [showUserList, setShowUserList] = useState(false);
  const [showOpenChats, setShowOpenChats] = useState(true);
  // const [displayRecentDMs] = useState(true); // Removed unused variable
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Get data from contexts
  const {
    messages,
    setMessages,
    loading: messagesLoading,
    activeConversation,
    conversationType,
    typing,
    unreadMessages,
    loadMessages,
    sendMessage,
    deleteMessage,
    markAsRead,
    setActiveConversation,
    setConversationType
  } = useMessages();
  
  const {
    channels,
    directConversations,
    users,
    // loading: conversationsLoading, // Removed unused variable
    startDirectConversation,
    removeConversation
  } = useConversations();
  
  // Function to scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  // Initialize with default channel
  useEffect(() => {
    if (!activeConversation && channels.length > 0) {
      console.log('Initializing with default channel. Available channels:', 
        channels.map(c => ({ id: c.id, name: c.name })));
      
      // Prefer 'general' channel as default, fall back to first channel
      const defaultChannel = channels.find(c => 
        c.id === 'general' || c.name === 'general'
      ) || channels[0];
      
      console.log('Selected default channel:', defaultChannel);
      
      // Ensure the channel has the expected properties
      if (!defaultChannel || (!defaultChannel.id && !defaultChannel.name)) {
        console.error('Invalid default channel:', defaultChannel);
        return;
      }
      
      setActiveConversation(defaultChannel);
      setConversationType('channel');
      loadMessages(defaultChannel, 'channel');
    }
  }, [channels, activeConversation, setActiveConversation, setConversationType, loadMessages]);

  // Debug channels and users - only log once when data changes
  useEffect(() => {
    if (channels.length > 0 || directConversations.length > 0 || users.length > 0) {
      console.log('Data loaded:', {
        channelsCount: channels.length,
        directConversationsCount: directConversations.length,
        usersCount: users.length
      });
    }
  }, [channels.length, directConversations.length, users.length]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Function to switch to a channel
  const handleChannelSelect = (channel) => {
    if (!channel) {
      console.error('Cannot select undefined/null channel');
      return;
    }
    
    console.log('Selecting channel:', {
      id: channel.id, 
      name: channel.name, 
      type: typeof channel === 'string' ? 'string' : 'object'
    });
    
    // Ensure we have a valid channel object before proceeding
    if (typeof channel === 'string') {
      // If a string was passed, find the matching channel object
      // First try to match by ID (which should be the channel name from database)
      let matchingChannel = channels.find(c => c.id === channel);
      
      // If not found, try by display name (case-insensitive)
      if (!matchingChannel) {
        matchingChannel = channels.find(c => 
          c.name.toLowerCase() === channel.toLowerCase()
        );
      }
      
      // If still not found, check if any channel ID contains this string
      // This helps with hyphenated names like 'tech-talk'
      if (!matchingChannel) {
        matchingChannel = channels.find(c => 
          c.id && c.id.includes(channel)
        );
      }
      
      if (matchingChannel) {
        channel = matchingChannel;
      } else {
        console.error(`Could not find channel object for name/id: ${channel}`);
        // Create a temporary channel object - use the string as both ID and name
        channel = { id: channel, name: channel };
      }
    }
    
    console.log('Selected channel object:', channel);
    setActiveConversation(channel);
    setConversationType('channel');
    
    // Ensure we're passing the correct channel identifier
    // For consistent channel handling, prefer to use the ID (which should be
    // the channel name in the database) over the name (which is for display)
    const channelId = channel.id || channel.name || (typeof channel === 'string' ? channel : null);
    if (!channelId) {
      console.error('Invalid channel selected, missing identifier:', channel);
      return;
    }
    
    console.log(`Loading messages for channel [${channelId}]`);
    loadMessages(channelId, 'channel');
    markAsRead(channelId);
    setShowUserList(false);
  };
  
  // Function to switch to a direct message conversation
  const handleDirectMessageSelect = (conversation) => {
    console.log('Selecting direct conversation with:', conversation);
    
    // Make sure we have a properly formatted conversation object with all required fields
    const formattedConversation = {
      ...conversation,
      _id: conversation._id || conversation.userId, // Ensure _id is set
      userId: conversation.userId || conversation._id, // Ensure userId is set
      username: conversation.username || 'Unknown User'
    };
    
    // Generate a standard conversation ID that will be the same for both users
    if (user && user._id && formattedConversation.userId) {
      // Create a sorted DM conversation ID for consistency
      const sortedIds = [user._id.toString(), formattedConversation.userId.toString()].sort();
      const standardConversationId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
      
      // Store this standardized ID
      formattedConversation.standardConversationId = standardConversationId;
      
      console.log(`Created standard conversation ID: ${standardConversationId}`);
    }
    
    // Set the active conversation and load messages
    setActiveConversation(formattedConversation);
    setConversationType('direct');
    
    // First load the messages
    loadMessages(formattedConversation, 'direct');
    
    // Then mark them as read (if loading was successful)
    if (formattedConversation._id && unreadMessages[formattedConversation._id] > 0) {
      // Add a slight delay to ensure messages are loaded first
      setTimeout(() => {
        markAsRead(formattedConversation._id);
      }, 100);
    }
    
    setShowUserList(false);
    
    // Log the active conversation for debugging
    console.log('Active conversation set to:', formattedConversation);
  };
  
  // Function to start a new direct message conversation
  const handleStartDirectMessage = async (user) => {
    // Comprehensive check for existing conversations with this user
    // This handles different ID formats and also checks username
    const existingConversation = directConversations.find(c => {
      // Check direct ID match
      if (c._id === user._id || c.userId === user._id) {
        return true;
      }
      
      // Check username match
      if (c.username === user.username) {
        return true;
      }
      
      // Check for dm_ format conversation IDs
      if (c._id && typeof c._id === 'string' && c._id.startsWith('dm_')) {
        // Extract the user IDs from the dm_ format
        const parts = c._id.split('_');
        if (parts.length === 3) {
          // Check if either user ID matches our target
          return parts[1] === user._id || parts[2] === user._id;
        }
      }
      
      // Check other user ID fields
      if (c.otherUser && c.otherUser._id === user._id) {
        return true;
      }
      
      return false;
    });
    
    if (existingConversation) {
      // If conversation exists, open it
      console.log('Opening existing conversation:', existingConversation);
      handleDirectMessageSelect(existingConversation);
    } else {
      try {
        // If not, create a new one
        console.log('Creating new conversation with:', user.username);
        const conversation = await startDirectConversation(user._id);
        if (conversation) {
          // Format conversation with required fields if they're missing
          const formattedConversation = {
            ...conversation,
            _id: conversation._id || user._id,
            username: conversation.username || user.username,
            status: user.status,
            profilePicture: user.profilePicture
          };
          handleDirectMessageSelect(formattedConversation);
          
          // Ensure open chats are visible
          setShowOpenChats(true);
          
          // Show success message
          toast.success(`Started conversation with ${user.username}`);
        } else {
          console.error("Failed to create conversation", user);
          toast.error("Failed to start conversation");
        }
      } catch (error) {
        console.error("Error starting direct message:", error);
        toast.error("Failed to start conversation");
      }
    }
    
    // Always make sure Recent DMs is visible
    setShowUserList(false);
  };
  
  // Function to handle creating a new channel (disabled as per requirements)
  // eslint-disable-next-line no-unused-vars
  const handleCreateChannel = async () => {
    // This functionality has been disabled as per requirements
    console.log('Channel creation is disabled');
    
    // Keep the original code commented out for future reference
    /*
    const channelName = prompt('Enter channel name:');
    if (channelName && channelName.trim()) {
      const channel = await createChannel(channelName);
      if (channel) {
        handleChannelSelect({
          id: channel._id,
          name: channel.name,
          icon: channel.icon || '💬'
        });
      }
    }
    */
  };
  
  // Function to handle message input change
  const handleMessageInputChange = (e) => {
    setMessage(e.target.value);
    
    // Clear previous typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Only emit typing event if we have an active conversation
    if (connected && activeConversation) {
      // Create appropriate channel ID based on conversation type
      const channelId = conversationType === 'channel' 
        ? activeConversation.id
        : `${user._id}-${activeConversation._id}`;
        
      // Emit typing event through socket context
      const socketPayload = {
        channel: channelId,
        username: user.username
      };
      
      // This event will be handled by the SocketProvider
      window.dispatchEvent(new CustomEvent('socket:emit', {
        detail: {
          event: 'typing',
          data: socketPayload
        }
      }));
      
      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('socket:emit', {
          detail: {
            event: 'stopTyping',
            data: { channel: channelId }
          }
        }));
      }, 2000);
    }
  };
  
  // Function to handle sending a message
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (message.trim() && activeConversation) {
      const success = sendMessage(message);
      if (success) {
        setMessage('');
      }
    }
  };
  
  // Function to handle message deletion
  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessage(messageId);
    }
  };
  
  // Function to handle removing a conversation from the list
  const handleRemoveConversation = async (e, userId) => {
    e.stopPropagation(); // Prevent opening the conversation when clicking the delete button
    
    if (window.confirm('Remove this conversation from your recent list? All messages will be deleted.')) {
      try {
        // Display loading toast
        const loadingToastId = toast.loading('Removing conversation...');
        
        // Use the removeConversation function from ConversationContext
        // This now handles the API call to delete messages on the backend
        await removeConversation(userId);
        
        // If the active conversation is the one being removed, clear it
        if (conversationType === 'direct' && activeConversation && activeConversation._id === userId) {
          setActiveConversation(null);
          setMessages([]); // Clear displayed messages
        }
        
        // Dismiss loading toast and show success
        toast.dismiss(loadingToastId);
        toast.success('Conversation and messages removed successfully');
      } catch (error) {
        console.error('Error in handleRemoveConversation:', error);
        toast.error('Failed to remove conversation completely');
      }
    }
  };
  
  // Filter channels based on search term
  const getFilteredChannels = () => {
    // Don't log on every render to avoid excessive console output
    if (channels.length > 0) {
      console.log(`Found ${channels.length} channels to filter`);
    }
    return channels
      .filter(channel => {
        // Remove the "genral" channel and filter by search term
        return channel.name.toLowerCase() !== 'genral' && 
               channel.name.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        // Sort by default channels first, then alphabetically
        if (a.isDefaultChannel && !b.isDefaultChannel) return -1;
        if (!a.isDefaultChannel && b.isDefaultChannel) return 1;
        return a.name.localeCompare(b.name);
      });
  };
  
  const getFilteredDirectMessages = () => {
    // First filter by search term
    const filtered = directConversations.filter(conversation => 
      conversation.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Remove duplicates by username
    const uniqueConversations = [];
    const seenUsernames = new Set();
    
    filtered.forEach(conversation => {
      // Check if we've already seen this username
      if (conversation.username && !seenUsernames.has(conversation.username.toLowerCase())) {
        seenUsernames.add(conversation.username.toLowerCase());
        uniqueConversations.push(conversation);
      }
    });
    
    return uniqueConversations;
  };
  
  const getFilteredUsers = () => users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Check if a message was sent by the current user
  const isCurrentUser = (senderId) => {
    return senderId === user._id;
  };
  
  // Get profile picture URL
  const getProfilePicture = (profilePicture) => {
    if (!profilePicture) return null;
    return profilePicture.startsWith('http') 
      ? profilePicture 
      : `${API_BASE_URL.replace('/api', '')}${profilePicture}`;
  };
  
  // Render sidebar toggle buttons
  const renderToggleButtons = () => {
    return (
      <div className="toggle-container">
        <button 
          className={`toggle-btn ${activeToggle === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveToggle('channels')}
        >
          Channels
        </button>
        <button 
          className={`toggle-btn ${activeToggle === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveToggle('messages')}
        >
          Messages
        </button>
      </div>
    );
  };
  
  // Render channels section
  const renderChannels = () => {
    return (
      <div className="channels-section">
        <div className="channels-header">
          <span>Channels</span>
          {/* Removed the + button completely since users cannot create channels */}
        </div>
        <ul className="channels-list">
          {getFilteredChannels().map(channel => (
            <li 
              key={channel._id || channel.id} 
              className={`channel-item ${conversationType === 'channel' && activeConversation && 
                (activeConversation._id === channel._id || activeConversation.id === channel.id || 
                 activeConversation === channel.name) ? 'active' : ''}`}
              onClick={() => handleChannelSelect(channel)}
            >
              # {channel.name}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  // Render direct messages section with online users
  const renderDirectMessages = () => {
    const onlineUsers = users.filter(u => u.status === 'online' && u._id !== user._id);
    
    return (
      <div className="direct-messages-section">
        <div className="channels-header">
          <span>Online Users</span>
        </div>
        {onlineUsers.length > 0 ? (
          <ul className="direct-messages-list">
            {onlineUsers.map(u => {
              // Check if this user already has a conversation in the recent list
              // to visually indicate it to the user
              const hasExistingConversation = directConversations.some(c => 
                c._id === u._id || 
                c.userId === u._id || 
                c.username === u.username ||
                (c._id && typeof c._id === 'string' && c._id.startsWith('dm_') && 
                  c._id.split('_').slice(1).includes(u._id))
              );
                        
              return (
                <li 
                  key={u._id} 
                  className={`dm-item ${hasExistingConversation ? 'existing-conversation' : ''}`}
                  onClick={() => handleStartDirectMessage(u)}
                >
                  <UserAvatar 
                    profilePicture={getProfilePicture(u.profilePicture)}
                    username={u.username}
                    status={u.status}
                    className="user-list-avatar"
                  />
                  <UserNameWithPreview
                    userId={u._id}
                    username={u.username}
                    profilePicture={u.profilePicture}
                    className="username"
                    previewContext={UserNameWithPreview.PREVIEW_CONTEXT.NONE}
                  />
                  <span className="status-dot online"></span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-list-message">No users online at the moment</div>
        )}
      </div>
    );
  };
  
  // Render recent DMs section (only showing conversations the user has actively started)
  const renderRecentDMs = () => {
    // Only show if there are any recent DMs
    if (directConversations.length === 0) return null;
    
    // Log to ensure we're rendering with the right data
    console.log('Rendering recent DMs with:', {
      directConversations: directConversations.map(c => ({ 
        _id: c._id, 
        username: c.username,
        status: c.status || 'unknown'
      }))
    });
    
    return (
      <div className="recent-dms-section">
        <div className="recent-dms-header">
          <span>My Conversations</span>
          <button 
            className="toggle-btn"
            onClick={() => setShowOpenChats(!showOpenChats)}
            title={showOpenChats ? "Hide conversations" : "Show conversations"}
          >
            {showOpenChats ? "−" : "+"}
          </button>
        </div>
        {showOpenChats && (
          <ul className="direct-messages-list">
            {getFilteredDirectMessages().length > 0 ? (
              getFilteredDirectMessages().map(conversation => {
                // Check if this conversation is active
                const isActive = conversationType === 'direct' && 
                                activeConversation && 
                                (activeConversation._id === conversation._id ||
                                 activeConversation.userId === conversation._id ||
                                 activeConversation._id === conversation.userId);
                
                // Make sure we have a user status, defaulting to offline if not set
                const userStatus = conversation.status || 'offline';
                
                return (
                  <li 
                    key={conversation._id} 
                    className={`dm-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleDirectMessageSelect(conversation)}
                  >
                    <UserAvatar 
                      profilePicture={getProfilePicture(conversation.profilePicture)}
                      username={conversation.username}
                      status={userStatus}
                      className="user-list-avatar"
                    />
                    <UserNameWithPreview
                      userId={conversation._id}
                      username={conversation.username}
                      profilePicture={conversation.profilePicture}
                      className="username"
                      previewContext={UserNameWithPreview.PREVIEW_CONTEXT.NONE}
                    />
                    <span className={`status-indicator ${userStatus}`}></span>
                    <button 
                      className="remove-conversation-btn"
                      onClick={(e) => handleRemoveConversation(e, conversation._id)}
                      title="Remove from recent conversations"
                    >
                      ×
                    </button>
                  </li>
                );
              })
            ) : (
              <div className="empty-list-message">No active conversations yet</div>
            )}
          </ul>
        )}
      </div>
    );
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="messaging-hub">
      <Navbar />
      <div className="messaging-container">
        
        {/* Sidebar */}
        <div className="sidebar">
          {/* Search */}
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Toggle between channels and direct messages */}
          {renderToggleButtons()}
          
          {/* Channel List */}
          {activeToggle === 'channels' && renderChannels()}
          
          {/* Direct Messages Section */}
          {activeToggle === 'messages' && (
            <>
              {renderDirectMessages()}
              {renderRecentDMs()}
              
              {/* Button to view all users (not just online ones) */}
              <div className="view-all-users-button-container">
                <button 
                  className="view-all-users-button"
                  onClick={() => setShowUserList(!showUserList)}
                >
                  {showUserList ? 'Hide All Users' : 'View All Users'}
                </button>
              </div>
              
              {/* User List for Starting New Conversations */}
              {showUserList && (
                <div className="user-list-section">
                  <div className="channels-header">
                    <span>All Users</span>
                    <button 
                      className="close-btn"
                      onClick={() => setShowUserList(false)}
                      title="Close user list"
                    >
                      ×
                    </button>
                  </div>
                  <ul className="direct-messages-list">
                    {getFilteredUsers()
                      .filter(u => u._id !== user._id)
                      .map(u => {
                        // Check if this user already has a conversation in the recent list
                        // to visually indicate it to the user
                        const hasExistingConversation = directConversations.some(c => 
                          c._id === u._id || 
                          c.userId === u._id || 
                          c.username === u.username ||
                          (c._id && typeof c._id === 'string' && c._id.startsWith('dm_') && 
                            c._id.split('_').slice(1).includes(u._id))
                        );
                        
                        return (
                          <li 
                            key={u._id} 
                            className={`dm-item ${hasExistingConversation ? 'existing-conversation' : ''}`}
                            onClick={() => handleStartDirectMessage(u)}
                          >
                          <UserAvatar 
                            profilePicture={getProfilePicture(u.profilePicture)}
                            username={u.username}
                            status={u.status}
                            className="user-list-avatar"
                          />
                          <UserNameWithPreview
                     userId={u._id}
                     username={u.username}
                     profilePicture={u.profilePicture}
                     className="username"
                   />
                          {u.status === 'online' && (
                            <span className="status-dot online"></span>
                          )}
                        </li>
                        );
                      })
                    }
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Main Content */}
        <div className="main-content">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-title">
                  {conversationType === 'channel' 
                    ? `# ${typeof activeConversation === 'string' 
                        ? activeConversation 
                        : activeConversation.name}`
                    : (activeConversation && activeConversation.username 
                        ? `${activeConversation.username}`
                        : 'Direct Message')}
                </div>
                <div className="chat-subtitle">
                  {conversationType === 'direct' && activeConversation?.status && (
                    <span className={`status-indicator ${activeConversation.status}`}>
                      {activeConversation.status === 'online' ? '• Online' : ''}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Messages Container */}
              <div className="messages-container" ref={messagesEndRef}>
                {messagesLoading ? (
                  <div className="loading-messages">Loading messages...</div>
                ) : (
                  <div className="messages-list">
                    {messages.length === 0 && conversationType === 'direct' ? (
                      <div className="empty-conversation-message">
                        <p>Start a conversation with {activeConversation?.username || 'this user'}.</p>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <div 
                          key={msg._id} 
                          className={`message ${isCurrentUser(msg.sender?._id) ? 'sent' : 'received'} ${msg.isDeleted ? 'deleted' : ''} ${msg.pending ? 'pending' : ''}`}
                        >
                          <div className="message-avatar">
                            <UserAvatar 
                              profilePicture={getProfilePicture(msg.sender?.profilePicture)} 
                              username={msg.sender?.username || 'Unknown'}
                            />
                          </div>
                          <div className="message-content">
                            <div className="message-header">
                              {/* Log sender ID for debugging */}
                              {console.log('Message sender ID:', msg.sender?._id)}
                              <UserNameWithPreview
                                userId={msg.sender?._id}
                                username={msg.sender?.username || 'Unknown'}
                                profilePicture={msg.sender?.profilePicture}
                                className="message-username"
                                previewContext={UserNameWithPreview.PREVIEW_CONTEXT.MESSAGE}
                              />
                              <span className="message-time">{formatTime(msg.timestamp)}</span>
                            </div>
                            <div className="message-text">
                              {msg.deleting ? 'Deleting...' : msg.content}
                            </div>
                            {isCurrentUser(msg.sender?._id) && !msg.isDeleted && !msg.deleting && (
                              <button 
                                className="delete-button" 
                                onClick={() => handleDeleteMessage(msg._id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {typing && (
                      <div className="typing-indicator">
                        {typing} is typing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Message Input */}
              <div className="message-input-container">
                <form className="message-form" onSubmit={handleSendMessage}>
                  <textarea
                    className="message-input"
                    value={message}
                    onChange={handleMessageInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    disabled={!connected}
                  />
                  <button 
                    className="send-button" 
                    type="submit"
                    disabled={!message.trim() || !connected}
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="welcome-container">
              <div className="welcome-content">
                <div className="welcome-icon">💬</div>
                <h2 className="welcome-title">Welcome to InstantChat</h2>
                <p className="welcome-description">
                  Start connecting with your team in real-time
                </p>
                <div className="welcome-instructions">
                  <div className="welcome-step">
                    <div className="step-number">1</div>
                    <div className="step-text">Select a channel from the sidebar</div>
                  </div>
                  <div className="welcome-step">
                    <div className="step-number">2</div>
                    <div className="step-text">Or start a direct message with a team member</div>
                  </div>
                  <div className="welcome-step">
                    <div className="step-number">3</div>
                    <div className="step-text">Send messages, share ideas, and collaborate</div>
                  </div>
                </div>
                {activeToggle === 'channels' ? (
                  <button 
                    className="welcome-action-btn"
                    onClick={() => setActiveToggle('messages')}
                  >
                    View Direct Messages
                  </button>
                ) : (
                  <button 
                    className="welcome-action-btn"
                    onClick={() => setShowUserList(!showUserList)}
                  >
                    Find People
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingHub;

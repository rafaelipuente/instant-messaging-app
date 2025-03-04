import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useMessages } from '../context/MessageContext';
import { useConversations } from '../context/ConversationContext';
import UserAvatar from './UserAvatar';
import Navbar from './Navbar';
import { API_BASE_URL } from '../config';
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
    
    // Set the active conversation and load messages
    setActiveConversation(conversation);
    setConversationType('direct');
    
    // First load the messages
    loadMessages(conversation, 'direct');
    
    // Then mark them as read (if loading was successful)
    if (conversation._id && unreadMessages[conversation._id] > 0) {
      // Add a slight delay to ensure messages are loaded first
      setTimeout(() => {
        markAsRead(conversation._id);
      }, 100);
    }
    
    setShowUserList(false);
  };
  
  // Function to start a new direct message conversation
  const handleStartDirectMessage = async (user) => {
    // Check if a conversation already exists with this user
    const existingConversation = directConversations.find(
      c => c._id === user._id || c.userId === user._id
    );
    
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
            username: conversation.username || user.username
          };
          handleDirectMessageSelect(formattedConversation);
          
          // Ensure open chats are visible
          setShowOpenChats(true);
        } else {
          console.error("Failed to create conversation", user);
        }
      } catch (error) {
        console.error("Error starting direct message:", error);
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
  const handleRemoveConversation = (e, userId) => {
    e.stopPropagation(); // Prevent opening the conversation when clicking the delete button
    
    if (window.confirm('Remove this conversation from your recent list?')) {
      // Use the removeConversation function from ConversationContext
      removeConversation(userId);
      
      // If the active conversation is the one being removed, clear it
      if (conversationType === 'direct' && activeConversation && activeConversation._id === userId) {
        setActiveConversation(null);
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
  
  const getFilteredDirectMessages = () => directConversations.filter(conversation => 
    conversation.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
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
  
  // Render direct messages section
  const renderDirectMessages = () => {
    return (
      <div className="direct-messages-section">
        <div className="channels-header">
          <span>Online User List</span>
          <button 
            className="create-dm-btn"
            onClick={() => setShowUserList(!showUserList)}
            title="Start a new conversation"
          >
            +
          </button>
        </div>
      </div>
    );
  };
  
  // Render recent DMs section
  const renderRecentDMs = () => {
    // Only show if there are any recent DMs
    if (directConversations.length === 0) return null;
    
    return (
      <div className="recent-dms-section">
        <div className="recent-dms-header">
          <span>Recent Conversations</span>
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
            {getFilteredDirectMessages().map(user => (
              <li 
                key={user._id} 
                className={`dm-item ${conversationType === 'direct' && 
                  activeConversation && activeConversation._id === user._id ? 'active' : ''}`}
                onClick={() => handleStartDirectMessage(user)}
              >
                <div className="user-avatar">
                  {user.username.charAt(0)}
                </div>
                <span className="username">{user.username}</span>
                <button 
                  className="remove-conversation-btn"
                  onClick={(e) => handleRemoveConversation(e, user._id)}
                  title="Remove from recent conversations"
                >
                  ×
                </button>
              </li>
            ))}
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
                      .map(u => (
                        <li 
                          key={u._id} 
                          className="dm-item"
                          onClick={() => handleStartDirectMessage(u)}
                        >
                          <UserAvatar 
                            profilePicture={getProfilePicture(u.profilePicture)}
                            username={u.username}
                            status={u.status}
                            className="user-list-avatar"
                          />
                          <span className="username">{u.username}</span>
                          {u.status === 'online' && (
                            <span className="status-dot online"></span>
                          )}
                        </li>
                      ))
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
                              <span className="message-username">{msg.sender?.username || 'Unknown'}</span>
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
              <div className="welcome-icon">💬</div>
              <h2 className="welcome-title">Welcome to Instant Chat</h2>
              <p className="welcome-description">
                Select a channel or direct message to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingHub;

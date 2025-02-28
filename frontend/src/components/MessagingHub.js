import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useMessages } from '../context/MessageContext';
import { useConversations } from '../context/ConversationContext';
import UserAvatar from './UserAvatar';
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
  const [showChannels, setShowChannels] = useState(true);
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showRecentDMs, setShowRecentDMs] = useState(true);
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
    loading: conversationsLoading,
    startDirectConversation,
    createChannel
  } = useConversations();
  
  // Function to scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  // Initialize with default channel
  useEffect(() => {
    if (!activeConversation && channels.length > 0) {
      const defaultChannel = channels.find(c => c.id === 'general') || channels[0];
      setActiveConversation(defaultChannel);
      setConversationType('channel');
      loadMessages(defaultChannel, 'channel');
    }
  }, [channels, activeConversation, setActiveConversation, setConversationType, loadMessages]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Function to switch to a channel
  const handleChannelSelect = (channel) => {
    setActiveConversation(channel);
    setConversationType('channel');
    loadMessages(channel, 'channel');
    markAsRead(channel.id);
    setShowUserList(false);
  };
  
  // Function to switch to a direct message conversation
  const handleDirectMessageSelect = (conversation) => {
    setActiveConversation(conversation);
    setConversationType('direct');
    
    // First load the messages
    const loadSuccess = loadMessages(conversation, 'direct');
    
    // Then mark them as read (if loading was successful)
    if (loadSuccess && conversation._id && unreadMessages[conversation._id] > 0) {
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
      // If not, create a new one
      console.log('Creating new conversation with:', user.username);
      const conversation = await startDirectConversation(user._id);
      if (conversation) {
        handleDirectMessageSelect(conversation);
      }
    }
    
    // Always make sure Recent DMs is visible
    setShowRecentDMs(true);
  };
  
  // Function to handle creating a new channel (disabled as per requirements)
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
  
  // Filter channels based on search term
  const filteredChannels = channels
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
  
  const filteredDirectMessages = directConversations.filter(conversation => 
    conversation.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredUsers = users.filter(user => 
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
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          {/* Toggle between channels and direct messages */}
          <div className="toggle-container">
            <button 
              className={`toggle-button ${showChannels ? 'active' : ''}`}
              onClick={() => {
                setShowChannels(true);
                setShowDirectMessages(false);
                setShowUserList(false);
              }}
            >
              Channels
            </button>
            <button 
              className={`toggle-button ${showDirectMessages ? 'active' : ''}`}
              onClick={() => {
                setShowChannels(false);
                setShowDirectMessages(true);
                setShowUserList(false);
              }}
            >
              Direct Messages
            </button>
          </div>
          
          {/* Channel List */}
          {showChannels && (
            <div className="channel-list">
              <div className="section-header">
                <h3>Channels</h3>
                {/* Create Channel button removed as per requirement */}
              </div>
              
              {conversationsLoading ? (
                <div className="loading">Loading channels...</div>
              ) : (
                <ul>
                  {filteredChannels.map(channel => (
                    <li 
                      key={channel.id} 
                      className={activeConversation?.id === channel.id ? 'active' : ''}
                      onClick={() => handleChannelSelect(channel)}
                    >
                      <span className="channel-icon">{channel.icon}</span>
                      <span className="channel-name">{channel.name}</span>
                      {unreadMessages[channel.id] > 0 && (
                        <span className="unread-badge">{unreadMessages[channel.id]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          {/* Direct Messages Section */}
          {showDirectMessages && (
            <div className="dm-list">
              <div className="section-header">
                <h3>Direct Messages</h3>
                <button
                  className="toggle-users-button"
                  onClick={() => setShowUserList(!showUserList)}
                >
                  {showUserList ? 'Hide Users' : 'Show All Users'}
                </button>
              </div>
              
              {/* Recent DMs Section */}
              {showRecentDMs && (
                <div className="recent-dms">
                  <div className="section-header">
                    <h4>Recent Conversations</h4>
                  </div>
                  
                  {conversationsLoading ? (
                    <div className="loading">Loading conversations...</div>
                  ) : (
                    directConversations.length > 0 ? (
                      <ul>
                        {filteredDirectMessages.map(conversation => (
                          <li 
                            key={conversation._id} 
                            className={activeConversation?._id === conversation._id ? 'active' : ''}
                            onClick={() => handleDirectMessageSelect(conversation)}
                          >
                            <UserAvatar 
                              src={getProfilePicture(conversation.profilePicture)} 
                              username={conversation.username}
                              status={conversation.status || 'offline'}
                            />
                            <span className="user-name">{conversation.username}</span>
                            <div className="conversation-meta">
                              {conversation.lastMessage && (
                                <span className="last-message-time">
                                  {formatTime(conversation.lastMessage.timestamp)}
                                </span>
                              )}
                              {unreadMessages[conversation._id] > 0 && (
                                <span className="unread-badge">{unreadMessages[conversation._id]}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="empty-state">No recent conversations</div>
                    )
                  )}
                </div>
              )}
              
              {/* User List for Starting New Conversations */}
              {showUserList && (
                <div className="user-list">
                  <div className="section-header">
                    <h4>All Users</h4>
                  </div>
                  
                  <ul>
                    {filteredUsers.map(user => (
                      <li 
                        key={user._id}
                        onClick={() => handleStartDirectMessage(user)}
                      >
                        <UserAvatar 
                          src={getProfilePicture(user.profilePicture)} 
                          username={user.username}
                          status={user.status || 'offline'}
                        />
                        <span className="user-name">{user.username}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Main Chat Area */}
        <div className="chat-area">
          {/* Chat Header */}
          <div className="chat-header">
            {activeConversation && (
              <>
                {conversationType === 'channel' ? (
                  <div className="channel-info">
                    <span className="channel-icon">{activeConversation.icon}</span>
                    <h2>{activeConversation.name}</h2>
                  </div>
                ) : (
                  <div className="user-info">
                    <UserAvatar 
                      src={getProfilePicture(activeConversation.profilePicture)} 
                      username={activeConversation.username}
                      status={activeConversation.status || 'offline'}
                    />
                    <h2>{activeConversation.username}</h2>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Messages */}
          <div className="messages-container">
            {messagesLoading ? (
              <div className="loading-messages">Loading messages...</div>
            ) : (
              <>
                {messages.length === 0 ? (
                  <div className="no-messages">
                    {conversationType === 'channel' 
                      ? 'No messages in this channel yet. Be the first to send a message!' 
                      : 'No messages in this conversation yet. Say hello!'}
                  </div>
                ) : (
                  <div className="messages">
                    {messages.map((msg) => (
                      <div 
                        key={msg._id} 
                        className={`message ${isCurrentUser(msg.sender?._id) ? 'sent' : 'received'} ${msg.isDeleted ? 'deleted' : ''} ${msg.pending ? 'pending' : ''}`}
                      >
                        <div className="message-avatar">
                          <UserAvatar 
                            src={getProfilePicture(msg.sender?.profilePicture)} 
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
                    ))}
                    {typing && (
                      <div className="typing-indicator">
                        {typing} is typing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Message Input */}
          <form className="message-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder={activeConversation 
                ? `Message ${conversationType === 'channel' ? '#' + activeConversation.name : activeConversation.username}` 
                : 'Select a conversation'}
              value={message}
              onChange={handleMessageInputChange}
              disabled={!activeConversation || !connected}
              className="message-input"
            />
            <button 
              type="submit" 
              disabled={!message.trim() || !activeConversation || !connected}
              className="send-button"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MessagingHub;

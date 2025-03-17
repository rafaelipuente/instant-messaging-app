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
  const { socket, connected } = useSocket(); // Access socket instance
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeToggle, setActiveToggle] = useState('channels');
  const [showUserList, setShowUserList] = useState(false);
  const [showOpenChats, setShowOpenChats] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const previousRoomRef = useRef(null);
  // Track last conversation switch time to prevent rapid switching
  const lastSwitchTimeRef = useRef(0); // Track previous room for leaving

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
      
      if (!defaultChannel || (!defaultChannel.id && !defaultChannel.name)) {
        console.error('Invalid default channel:', defaultChannel);
        return;
      }
      
      setActiveConversation(defaultChannel);
      setConversationType('channel');
      loadMessages(defaultChannel, 'channel');
      
      // Join default channel room
      if (socket) {
        const channelId = defaultChannel.id || defaultChannel.name;
        socket.emit('join_room', `channel_${channelId}`);
        previousRoomRef.current = channelId;
        console.log(`Joined default room: channel_${channelId}`);
      }
    }
  }, [channels, activeConversation, setActiveConversation, setConversationType, loadMessages, socket]);

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
    
    // Prevent rapid channel switching - throttle to one switch per second
    const now = Date.now();
    if (now - lastSwitchTimeRef.current < 1000) {
      console.log('Throttling channel switch - too rapid');
      return;
    }
    lastSwitchTimeRef.current = now;
    
    console.log('Selecting channel:', {
      id: channel.id, 
      name: channel.name, 
      type: typeof channel === 'string' ? 'string' : 'object'
    });
    
    setMessages([]); // Clear messages before loading new ones
    
    let channelId = channel.id || channel.name;
    if (typeof channel === 'string') {
      let matchingChannel = channels.find(c => c.id === channel);
      if (!matchingChannel) {
        matchingChannel = channels.find(c => 
          c.name.toLowerCase() === channel.toLowerCase()
        );
      }
      if (!matchingChannel) {
        matchingChannel = channels.find(c => 
          c.id && c.id.includes(channel)
        );
      }
      if (matchingChannel) {
        channel = matchingChannel;
        channelId = channel.id || channel.name;
      } else {
        channel = { id: channel, name: channel };
      }
    }
    
    console.log('Selected channel object:', channel);
    setActiveConversation(channel);
    setConversationType('channel');
    
    const roomId = `channel_${channelId}`;
    if (previousRoomRef.current && socket) {
      socket.emit('leave_room', `channel_${previousRoomRef.current}`);
      console.log(`Left room: channel_${previousRoomRef.current}`);
    }
    if (socket) {
      socket.emit('join_room', roomId);
      console.log(`Joined room: ${roomId}`);
    }
    previousRoomRef.current = channelId;

    // Delay loading messages slightly to avoid rapid concurrent requests
    setTimeout(() => {
      loadMessages(channelId, 'channel');
    }, 100);
    markAsRead(channelId);
    setShowUserList(false);
  };
  
  // Function to handle selecting a direct message conversation
  const handleDirectMessageSelect = (conversation) => {
    if (!conversation) {
      console.error('Cannot select undefined/null conversation');
      return;
    }
    
    // Prevent rapid conversation switching - throttle to one switch per second
    const now = Date.now();
    if (now - lastSwitchTimeRef.current < 1000) {
      console.log('Throttling direct message switch - too rapid');
      return;
    }
    lastSwitchTimeRef.current = now;
    
    setMessages([]);
    
    let formattedConversation = conversation;
    
    // Standardize the conversation format
    if (typeof conversation === 'string') {
      formattedConversation = directConversations.find(c => c._id === conversation);
      if (!formattedConversation) {
        console.error('Could not find direct conversation with ID:', conversation);
        return;
      }
    }
    
    // Ensure the conversation has a standardConversationId for room joining
    if (!formattedConversation.standardConversationId && formattedConversation._id && user?._id) {
      const otherUserId = formattedConversation.userId || formattedConversation._id;
      const sortedIds = [user._id, otherUserId].sort();
      formattedConversation.standardConversationId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
      console.log('Generated standardConversationId:', formattedConversation.standardConversationId);
    }
    
    console.log('Selecting direct message conversation:', { 
      id: formattedConversation._id,
      userId: formattedConversation.userId,
      standardConversationId: formattedConversation.standardConversationId,
      username: formattedConversation.username
    });
    
    // Setup conversation room joining based on standardConversationId
    if (socket && formattedConversation.standardConversationId) {
      if (previousRoomRef.current) {
        const prevRoom = previousRoomRef.current.startsWith('channel_')
          ? previousRoomRef.current
          : `dm_${previousRoomRef.current}`;
          
        socket.emit('leave_room', prevRoom);
        console.log(`Left room: ${prevRoom}`);
      }
      
      // Join the direct message room using standardConversationId
      const roomId = formattedConversation.standardConversationId;
      socket.emit('join_room', roomId);
      console.log(`Joined direct message room: ${roomId}`);
      previousRoomRef.current = roomId;
      
      // Request room list for debugging
      setTimeout(() => {
        console.log("Checking rooms user has joined...");
        socket.emit('getRooms');
      }, 500);
      
      // Also join user-specific room for direct messages
      if (formattedConversation.userId) {
        const userSpecificRoom = formattedConversation.userId;
        socket.emit('join_room', userSpecificRoom);
        console.log(`Joined user-specific room: ${userSpecificRoom}`);
      }
    } else {
      console.warn('Socket not available or missing standardConversationId for room joining');
    }
    
    setActiveConversation(formattedConversation);
    setConversationType('direct');
    
    // Delay loading messages slightly to avoid rapid concurrent requests
    setTimeout(() => {
      loadMessages(formattedConversation, 'direct');
    }, 100);
    
    setShowUserList(false);
    console.log('Active conversation set to:', formattedConversation);
  };
  
  // Function to start a new direct message conversation
  const handleStartDirectMessage = async (user) => {
    const existingConversation = directConversations.find(c => {
      if (c._id === user._id || c.userId === user._id) return true;
      if (c.username === user.username) return true;
      if (c._id && typeof c._id === 'string' && c._id.startsWith('dm_')) {
        const parts = c._id.split('_');
        if (parts.length === 3) return parts[1] === user._id || parts[2] === user._id;
      }
      if (c.otherUser && c.otherUser._id === user._id) return true;
      return false;
    });
    
    if (existingConversation) {
      console.log('Opening existing conversation:', existingConversation);
      handleDirectMessageSelect(existingConversation);
    } else {
      try {
        console.log('Creating new conversation with:', user.username);
        const conversation = await startDirectConversation(user._id);
        if (conversation) {
          const formattedConversation = {
            ...conversation,
            _id: conversation._id || user._id,
            username: conversation.username || user.username,
            status: user.status,
            profilePicture: user.profilePicture
          };
          handleDirectMessageSelect(formattedConversation);
          setShowOpenChats(true);
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
    setShowUserList(false);
  };
  
  // Function to handle message input change
  const handleMessageInputChange = (e) => {
    setMessage(e.target.value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (connected && activeConversation) {
      const channelId = conversationType === 'channel' 
        ? activeConversation.id || activeConversation.name
        : `${user._id}-${activeConversation._id}`;
        
      const socketPayload = {
        channel: channelId,
        username: user.username
      };
      
      window.dispatchEvent(new CustomEvent('socket:emit', {
        detail: {
          event: 'typing',
          data: socketPayload
        }
      }));
      
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
    // Prevent the default button action
    e.preventDefault();
    // Stop the event from bubbling up to parent elements
    e.stopPropagation();
    
    console.log('Removing conversation:', userId);
    
    // Use setTimeout to ensure the event is fully handled before showing the confirmation
    // This prevents any parent handlers from accidentally being triggered
    setTimeout(async () => {
      if (window.confirm('Remove this conversation from your recent list? All messages will be deleted.')) {
        const loadingToastId = toast.loading('Removing conversation...');
        try {
          await removeConversation(userId);
          if (conversationType === 'direct' && activeConversation && activeConversation._id === userId) {
            setActiveConversation(null);
            setMessages([]);
          }
          toast.dismiss(loadingToastId);
          toast.success('Conversation and messages removed successfully');
        } catch (error) {
          console.error('Error in handleRemoveConversation:', error);
          toast.dismiss(loadingToastId);
          toast.error('Failed to remove conversation completely');
        }
      }
    }, 0);
  };
  
  // Filter channels based on search term
  const getFilteredChannels = () => {
    if (channels.length > 0) {
      console.log(`Found ${channels.length} channels to filter`);
    }
    return channels
      .filter(channel => 
        channel.name.toLowerCase() !== 'genral' && 
        channel.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (a.isDefaultChannel && !b.isDefaultChannel) return -1;
        if (!a.isDefaultChannel && b.isDefaultChannel) return 1;
        return a.name.localeCompare(b.name);
      });
  };
  
  const getFilteredDirectMessages = () => {
    const filtered = directConversations.filter(conversation => 
      conversation.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const uniqueConversations = [];
    const seenUsernames = new Set();
    filtered.forEach(conversation => {
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
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const isCurrentUser = (senderId) => {
    if (!senderId || !user || !user._id) return false;
    
    // Compare as strings to handle both ObjectId and string comparisons
    const currentUserId = user._id.toString();
    const messageSenderId = senderId.toString();
    
    console.log(`[IS_CURRENT_USER] Comparing ${messageSenderId} with ${currentUserId}: ${messageSenderId === currentUserId}`);
    
    return messageSenderId === currentUserId;
  };
  
  const getProfilePicture = (profilePicture) => {
    if (!profilePicture) return null;
    return profilePicture.startsWith('http') 
      ? profilePicture 
      : `${API_BASE_URL.replace('/api', '')}${profilePicture}`;
  };
  
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
  
  const renderChannels = () => {
    return (
      <div className="channels-section">
        <div className="channels-header">
          <span>Channels</span>
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
  
  const renderRecentDMs = () => {
    if (directConversations.length === 0) return null;
    
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
                const isActive = conversationType === 'direct' && 
                                activeConversation && 
                                (activeConversation._id === conversation._id ||
                                 activeConversation.userId === conversation._id ||
                                 activeConversation._id === conversation.userId);
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
                      onMouseDown={(e) => e.stopPropagation()}
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
        <div className="sidebar">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {renderToggleButtons()}
          {activeToggle === 'channels' && renderChannels()}
          {activeToggle === 'messages' && (
            <>
              {renderDirectMessages()}
              {renderRecentDMs()}
              <div className="view-all-users-button-container">
                <button 
                  className="view-all-users-button"
                  onClick={() => setShowUserList(!showUserList)}
                >
                  {showUserList ? 'Hide All Users' : 'View All Users'}
                </button>
              </div>
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
        <div className="main-content">
          {activeConversation ? (
            <>
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
                      messages.map(msg => {
                        const messageKey = msg.tempId || msg._id;
                        if (!messageKey) {
                          console.error('[MESSAGE RENDER] Message missing ID:', {
                            content: msg.content?.substring(0, 20),
                            sender: msg.sender?.username,
                            timestamp: msg.timestamp || msg.createdAt
                          });
                          return null;
                        }
                        
                        // Determine if this is a sent or received message
                        const isSentByCurrentUser = msg.sender && (
                          isCurrentUser(msg.sender._id) || 
                          (msg.sender.username && msg.sender.username === user.username)
                        );
                        
                        return (
                          <div 
                            key={messageKey}
                            data-message-id={msg._id}
                            data-temp-id={msg.tempId}
                            className={`message ${isSentByCurrentUser ? 'sent' : 'received'} ${msg.isDeleted ? 'deleted' : ''} ${msg.pending ? 'pending' : ''}`}
                          >
                            <div className="message-avatar">
                              <UserAvatar 
                                profilePicture={getProfilePicture(msg.sender?.profilePicture)} 
                                username={msg.sender?.username || 'Unknown'}
                              />
                            </div>
                            <div className="message-content">
                              <div className="message-header">
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
                              {isSentByCurrentUser && !msg.isDeleted && !msg.deleting && (
                                <button 
                                  className="delete-button" 
                                  onClick={() => handleDeleteMessage(msg._id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }).filter(Boolean)
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
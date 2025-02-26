import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import DirectMessages from './DirectMessages';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { SOCKET_URL } from '../config';
import '../styles/Chat.css';

const Chat = () => {
  const { user, getFullProfilePictureUrl, updateOpenChats } = useAuth();
  const [activeChannel, setActiveChannel] = useState('general');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [typing, setTyping] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDMs, setShowDMs] = useState(false);
  const [notifications, setNotifications] = useState({}); // Add notifications state
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const channels = [
    { id: 'general', name: 'General', icon: '🌐' },
    { id: 'tech', name: 'Tech Talk', icon: '💻' },
    { id: 'random', name: 'Random', icon: '🎲' },
    { id: 'music', name: 'Music', icon: '🎵' }
  ];

  // Function to add notification
  const addNotification = (channel) => {
    if (channel !== activeChannel) {
      setNotifications(prev => ({
        ...prev,
        [channel]: (prev[channel] || 0) + 1
      }));
    }
  };

  useEffect(() => {
    if (user && user.token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token: user.token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setSocket(newSocket);
        
        // Load messages for the initial channel
        setTimeout(() => {
          newSocket.emit('loadInitialMessages', { channel: activeChannel });
        }, 500);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    }
  }, [user, activeChannel]);

  useEffect(() => {
    if (!socket || !activeChannel) return;

    const normalizedChannel = activeChannel.toLowerCase().replace(' ', '-');
    console.log(`Joining channel: ${normalizedChannel}`);
    
    // Join channel and request messages
    socket.emit('join', { channel: normalizedChannel });
    socket.emit('loadInitialMessages', { channel: normalizedChannel });

    const handlePreviousMessages = (messages) => {
      setMessages(messages);
      setTimeout(scrollToBottom, 0);
    };

    const handleNewMessage = (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
      setTimeout(scrollToBottom, 0);
    };

    const handleTyping = ({ username }) => {
      if (username !== user.username) {
        setTyping(username);
      }
    };

    const handleStopTyping = () => {
      setTyping(null);
    };

    // Set up event listeners
    socket.on('previousMessages', handlePreviousMessages);
    socket.on('newChannelMessage', handleNewMessage);
    socket.on('userTyping', handleTyping);
    socket.on('userStopTyping', handleStopTyping);

    return () => {
      socket.off('previousMessages', handlePreviousMessages);
      socket.off('newChannelMessage', handleNewMessage);
      socket.off('userTyping', handleTyping);
      socket.off('userStopTyping', handleStopTyping);
    };
  }, [socket, activeChannel, user?.username]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (message) => {
      if (message.channel === activeChannel.toLowerCase()) {
        setMessages((prevMessages) => [...prevMessages, message]);
        setTimeout(scrollToBottom, 0);
      } else {
        // Handle notification for messages in other channels
        addNotification(message.channel);
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      console.log('Message deleted:', messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    };

    const handleMessageDeleteSuccess = ({ messageId }) => {
      console.log('Message delete success:', messageId);
      // Message already marked as deleted in the handleMessageDeleted handler
    };

    const handleMessageError = ({ error }) => {
      console.error('Message error:', error);
      // Revert any messages marked as deleting
      setMessages(prev => 
        prev.map(msg => 
          msg.isDeleting ? { ...msg, isDeleting: false } : msg
        )
      );
      // Show error to user
      toast.error(error || 'An error occurred with your message');
    };

    socket.on('message', handleMessageReceived);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageDeleteSuccess', handleMessageDeleteSuccess);
    socket.on('messageError', handleMessageError);

    return () => {
      socket.off('message');
      socket.off('messageDeleted');
      socket.off('messageDeleteSuccess');
      socket.off('messageError');
    };
  }, [socket, activeChannel, addNotification]);

  useEffect(() => {
    if (!socket || !activeChannel) return;
    
    // Join the room (channel)
    socket.emit('join room', activeChannel);
    console.log(`Joining room: ${activeChannel}`);
    
    // Listen for chat messages in this room
    const handleChatMessage = (msg) => {
      if (msg.room === activeChannel) {
        setMessages(prevMessages => [...prevMessages, msg]);
        scrollToBottom();
      }
    };
    
    socket.on('chat message', handleChatMessage);
    
    return () => {
      socket.off('chat message', handleChatMessage);
    };
  }, [socket, activeChannel]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket) {
      socket.on('userUpdated', (updatedUser) => {
        if (selectedUser?._id === updatedUser._id) {
          setSelectedUser({
            ...updatedUser,
            profilePicture: getFullProfilePictureUrl(updatedUser.profilePicture)
          });
        }
      });

      return () => {
        socket.off('userUpdated');
      };
    }
  }, [socket, selectedUser, getFullProfilePictureUrl]);

  useEffect(() => {
    // Load active chats on component mount
    const savedOpenChats = localStorage.getItem('openChats');
    if (savedOpenChats && user) {
      try {
        const openChatIds = JSON.parse(savedOpenChats);
        if (Array.isArray(openChatIds) && openChatIds.length > 0) {
          // Update auth context with saved open chats
          updateOpenChats(openChatIds);
        }
      } catch (error) {
        console.error('Error parsing saved open chats:', error);
      }
    }
  }, [user, updateOpenChats]);

  const handleChannelChange = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setShowDMs(false);
      setActiveChannel(channel.name);
      // Messages will be loaded in the useEffect when activeChannel changes
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (socket) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.emit('typing', {
        channel: activeChannel,
        username: user.username
      });

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', { channel: activeChannel });
      }, 1000);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    // For channel messages
    if (activeChannel && !showDMs) {
      const messageData = {
        content: message,
        room: activeChannel,
        sender: {
          _id: user._id,
          username: user.username
        },
        timestamp: new Date()
      };
      
      // Emit to socket with room information
      socket.emit('chat message', messageData);
      
      // Optimistically add to UI
      setMessages(prevMessages => [...prevMessages, messageData]);
      scrollToBottom();
    } else {
      // For direct messages - use existing directMessage event
      socket.emit('channelMessage', {
        content: message,
        channel: activeChannel
      });
    }
    
    setMessage('');
  };

  const handleUserClick = (clickedUser) => {
    setSelectedUser(clickedUser);
  };

  const closeUserModal = () => {
    setSelectedUser(null);
  };

  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      if (window.confirm('Are you sure you want to delete this message?')) {
        console.log('Deleting message:', messageId);
        
        // Mark message as deleting for visual feedback
        setMessages(prev => 
          prev.map(msg => 
            msg._id === messageId 
              ? { ...msg, isDeleting: true } 
              : msg
          )
        );
        
        // Send deletion request
        socket.emit('deleteMessage', { messageId });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      // Revert deleting status if there's an error
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, isDeleting: false } 
            : msg
        )
      );
    }
  }, [socket]);

  return (
    <div className="chat-container">
      <Navbar />
      <div className="chat-content">
        <div className="channels-sidebar">
          <h2 className="sidebar-heading">Channels</h2>
          {channels.map(channel => (
            <div
              key={channel.id}
              className={`channel-item ${activeChannel === channel.name ? 'active' : ''}`}
              onClick={() => handleChannelChange(channel.id)}
            >
              <span className="channel-icon">{channel.icon}</span>
              <span className="channel-name">{channel.name}</span>
            </div>
          ))}
          <div className="channels-divider"></div>
          <div 
            className={`channel-item ${showDMs ? 'active' : ''}`}
            onClick={() => {
              setShowDMs(true);
              setActiveChannel(null);
            }}
          >
            <span className="channel-icon">💬</span>
            <span className="channel-name">Direct Messages</span>
          </div>
        </div>

        {showDMs ? (
          <DirectMessages 
            socketProp={socket} 
            addNotification={(notification) => addNotification(notification)} // Update addNotification reference
            addUnreadMessage={(userId, messageId) => console.log('Unread message:', userId, messageId)} 
          />
        ) : (
          <div className="chat-main">
            <div className="chat-header">
              <h2>{activeChannel}</h2>
            </div>

            <div className="messages-container">
              {messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`message ${msg.sender.username === user.username ? 'sent' : 'received'} ${msg.isDeleting ? 'deleting' : ''}`}
                >
                  <div className="message-wrapper">
                    <div className="message-header">
                      <span 
                        className="message-sender"
                        onClick={() => handleUserClick(msg.sender)}
                      >
                        {msg.sender.name || msg.sender.username}
                      </span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </span>
                    </div>
                    <div className="message-content">
                      <div className="message-text">{msg.content}</div>
                      <div className="message-timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                        {msg.sender._id === user._id && (
                          <button 
                            className="delete-message-btn"
                            onClick={() => handleDeleteMessage(msg._id)}
                            aria-label="Delete message"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
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

            <form className="message-input-container" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={message}
                onChange={handleMessageChange}
                placeholder="Type a message..."
                className="message-input"
              />
              <button type="submit" className="send-button">
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="user-modal-overlay" onClick={closeUserModal}>
          <div className="user-modal" onClick={e => e.stopPropagation()}>
            <div className="user-modal-header">
              <h2>{selectedUser.name || selectedUser.username}'s Profile</h2>
              <button onClick={closeUserModal}>&times;</button>
            </div>
            <div className="user-modal-content">
              <div className="user-info">
                <div className="user-avatar">
                  {selectedUser.profilePicture ? (
                    <img 
                      src={selectedUser.profilePicture.startsWith('http') 
                        ? selectedUser.profilePicture 
                        : `${SOCKET_URL}${selectedUser.profilePicture}`}
                      alt={selectedUser.name}
                      className="user-avatar-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name || selectedUser.username)}&background=random`;
                      }}
                    />
                  ) : (
                    <div className="user-avatar-initial">
                      {(selectedUser.name || selectedUser.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="user-details">
                  <div className="user-detail">
                    <span className="detail-label">Username:</span>
                    <span className="detail-value">@{selectedUser.username}</span>
                  </div>
                  <div className="user-detail">
                    <span className="detail-label">Status:</span>
                    <span className={`status-badge ${selectedUser.status || 'online'}`}>
                      {selectedUser.status || 'Online'}
                    </span>
                  </div>
                  <button 
                    className="start-dm-button"
                    onClick={() => {
                      setShowDMs(true);
                      setActiveChannel(null);
                      closeUserModal();
                    }}
                  >
                    Send Direct Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;

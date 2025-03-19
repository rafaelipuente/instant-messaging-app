import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Navbar from './Navbar';
import DirectMessages from './DirectMessages';
import { SOCKET_URL } from '../config';
import '../styles/Chat.css';

const Chat = () => {
  const { user, getFullProfilePictureUrl } = useAuth();
  const { socket } = useSocket();
  const [activeChannel, setActiveChannel] = useState('General');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDMs, setShowDMs] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const channels = [
    { id: 'general', name: 'General', icon: '🌐' },
    { id: 'tech', name: 'Tech Talk', icon: '💻' },
    { id: 'random', name: 'Random', icon: '🎲' },
    { id: 'music', name: 'Music', icon: '🎵' }
  ];

  useEffect(() => {
    // Socket is now managed by SocketContext
  }, []);

  // Simple channel message handling - following friend's pattern
  useEffect(() => {
    if (socket && activeChannel) {
      console.log("Joining channel:", activeChannel);
      socket.emit('join', { userId: user._id, channel: activeChannel });

      // Load previous messages
      socket.on('previousMessages', (messages) => {
        console.log("Received previous messages for channel:", activeChannel);
        setMessages(messages);
        setTimeout(scrollToBottom, 0);
      });

      return () => {
        socket.off('previousMessages');
      };
    }
  }, [socket, activeChannel, user._id]);
  
  // Handle new messages separately - following friend's pattern
  useEffect(() => {
    if (!socket || !activeChannel) return;
    
    // Listen for new messages in the channel
    socket.on('message', (message) => {
      console.log("Received message via WebSocket:", message);
      console.log("Current channel:", activeChannel);
      
      // Only add messages for the current channel
      if (message.channel === activeChannel) {
        setMessages((prevMessages) => [...prevMessages, message]);
        scrollToBottom();
      }
    });
    
    return () => {
      socket.off('message');
    };
  }, [socket, activeChannel]);
  
  // Handle typing indicators separately
  useEffect(() => {
    if (!socket) return;
    
    socket.on('userTyping', ({ username }) => {
      if (username !== user.username) {
        setTyping(username);
      }
    });

    socket.on('userStopTyping', () => {
      setTyping(null);
    });
    
    return () => {
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [socket, user.username]);

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

  const handleChannelChange = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setActiveChannel(channel.name);
      setMessages([]);
      setShowDMs(false);
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
    if (message.trim() && socket) {
      socket.emit('message', {
        content: message.trim(),
        channel: activeChannel
      });
      setMessage('');
    }
  };

  const handleUserClick = (clickedUser) => {
    setSelectedUser(clickedUser);
  };

  const closeUserModal = () => {
    setSelectedUser(null);
  };

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
          <DirectMessages />
        ) : (
          <div className="chat-main">
            <div className="chat-header">
              <h2>{activeChannel}</h2>
            </div>

            <div className="messages-container">
              {messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`message ${msg.sender.username === user.username ? 'sent' : 'received'}`}
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
                    <div className="message-content">{msg.content}</div>
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

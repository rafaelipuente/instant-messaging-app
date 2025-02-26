import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import DirectMessages from './DirectMessages';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';
import '../styles/Chat.css';

const Chat = () => {
  const { user, getFullProfilePictureUrl, updateOpenChats } = useAuth();
  const [activeChannel, setActiveChannel] = useState('General');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
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
    if (user && user.token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token: user.token }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setSocket(newSocket);
      });

      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    }
  }, [user]);

  useEffect(() => {
    if (socket && activeChannel) {
      socket.emit('join', { channel: activeChannel });

      socket.on('previousMessages', (messages) => {
        setMessages(messages);
        setTimeout(scrollToBottom, 0);
      });

      socket.on('newChannelMessage', (message) => {
        setMessages(prevMessages => [...prevMessages, message]);
        setTimeout(scrollToBottom, 0);
      });

      socket.on('userTyping', ({ username }) => {
        if (username !== user.username) {
          setTyping(username);
        }
      });

      socket.on('userStopTyping', () => {
        setTyping(null);
      });

      return () => {
        socket.off('previousMessages');
        socket.off('newChannelMessage');
        socket.off('userTyping');
        socket.off('userStopTyping');
      };
    }
  }, [socket, activeChannel, user.username]);

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
      socket.emit('channelMessage', {
        content: message.trim(),
        channel: activeChannel.toLowerCase()
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
          <DirectMessages socket={socket} />
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

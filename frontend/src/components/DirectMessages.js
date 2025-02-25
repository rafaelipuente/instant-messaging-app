import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import io from 'socket.io-client';
import '../styles/DirectMessages.css';

const DirectMessages = () => {
  const { user, updateOpenChats } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [failedImages, setFailedImages] = useState(new Set());
  const messagesEndRef = useRef(null);

  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return '/default-avatar.png';
    if (failedImages.has(profilePicture)) return '/default-avatar.png';
    if (profilePicture.startsWith('http')) return profilePicture;
    return `${SOCKET_URL}${profilePicture}`.replace(/([^:]\/)\/+/g, "$1");
  };

  const handleImageError = (profilePicture) => {
    setFailedImages(prev => new Set([...prev, profilePicture]));
  };

  useEffect(() => {
    if (!user?.token) {
      navigate('/login');
      return;
    }

    // Set initial open chats from user data
    if (user.openChats) {
      setActiveChats(user.openChats);
    }

    // Initialize socket connection
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: user.token
      },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      // Fetch initial data after socket connects
      fetchUsers();
      // Only fetch open chats if not provided in user data
      if (!user.openChats) {
        fetchOpenChats();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      navigate('/login');
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, [user?.token]);

  useEffect(() => {
    if (!socket || !user) return;

    socket.on('userConnected', () => {
      console.log('User connected, refreshing data...');
      fetchUsers();
    });

    socket.on('userDisconnected', () => {
      console.log('User disconnected, refreshing data...');
      fetchUsers();
    });

    socket.on('newDirectMessage', (message) => {
      console.log('New direct message received:', message);
      const otherUserId = message.sender._id === user._id ? message.receiver._id : message.sender._id;
      
      if (selectedUser && otherUserId === selectedUser._id) {
        setMessages(prev => [...prev, message]);
        setTimeout(scrollToBottom, 0);
      }

      // Add sender to open chats if not already there
      if (message.sender._id !== user._id) {
        addToOpenChats(message.sender._id);
      }
    });

    return () => {
      socket.off('newDirectMessage');
      socket.off('userConnected');
      socket.off('userDisconnected');
    };
  }, [socket, user, selectedUser]);

  const fetchUsers = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/list`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      // Reset failed images when fetching new user list
      setFailedImages(new Set());
      const filteredUsers = data.filter(u => u._id !== user._id).map(u => ({
        ...u,
        profilePicture: u.profilePicture || null
      }));
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOpenChats = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/open-chats`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch open chats');
      }

      const data = await response.json();
      setActiveChats(data);
    } catch (error) {
      console.error('Error fetching open chats:', error);
    }
  };

  const setAndUpdateOpenChats = (newChats) => {
    setActiveChats(newChats);
    updateOpenChats(newChats);
  };

  const addToOpenChats = async (userId) => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/open-chats/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to add to open chats');
      }

      const newChat = await response.json();
      const updatedChats = [...activeChats];
      if (!updatedChats.find(chat => chat._id === newChat._id)) {
        updatedChats.push(newChat);
        setAndUpdateOpenChats(updatedChats);
      }
    } catch (error) {
      console.error('Error adding to open chats:', error);
    }
  };

  const removeFromOpenChats = async (userId) => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/open-chats/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove from open chats');
      }

      const updatedChats = activeChats.filter(chat => chat._id !== userId);
      setAndUpdateOpenChats(updatedChats);
      
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error removing from open chats:', error);
    }
  };

  const handleUserSelect = async (clickedUser) => {
    setSelectedUser(clickedUser);
    setMessages([]); // Clear messages while loading

    try {
      // Add to open chats when selecting a user
      await addToOpenChats(clickedUser._id);

      const response = await fetch(`${SOCKET_URL}/api/messages/direct/${clickedUser._id}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      setMessages(data);
      setTimeout(scrollToBottom, 0);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser || !socket) return;

    try {
      socket.emit('directMessage', {
        content: message.trim(),
        receiverId: selectedUser._id
      });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="direct-messages">
      <div className="direct-messages-container">
        <div className="users-list">
          <div className="section-header">
            <button className="back-btn" onClick={() => navigate('/')}>Back</button>
            <h2>Private Messages</h2>
          </div>

          <div className="section">
            <h3>Users Online</h3>
            <div className="users-container">
              {users.map(user => (
                <div
                  key={user._id}
                  className={`user-item ${selectedUser?._id === user._id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="avatar-container">
                    <img
                      src={getProfilePictureUrl(user.profilePicture)}
                      alt={user.username}
                      className="user-avatar"
                      onError={() => handleImageError(user.profilePicture)}
                    />
                  </div>
                  <span className="username">{user.username}</span>
                </div>
              ))}
              {users.length === 0 && (
                <div className="no-users">No users online</div>
              )}
            </div>
          </div>

          <div className="section">
            <h3>Open DMs</h3>
            <div className="users-container">
              {activeChats.map(chat => (
                <div
                  key={chat._id}
                  className={`user-item ${selectedUser?._id === chat._id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(chat)}
                >
                  <div className="avatar-container">
                    <img
                      src={getProfilePictureUrl(chat.profilePicture)}
                      alt={chat.username}
                      className="user-avatar"
                      onError={() => handleImageError(chat.profilePicture)}
                    />
                    <span className={`status-indicator ${chat.status}`}></span>
                  </div>
                  <span className="username">{chat.username}</span>
                  <button 
                    className="close-chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromOpenChats(chat._id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {activeChats.length === 0 && (
                <div className="no-users">No open chats</div>
              )}
            </div>
          </div>
        </div>

        <div className="chat-area">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <div className="user-info">
                  <div className="avatar-container">
                    <img
                      src={getProfilePictureUrl(selectedUser.profilePicture)}
                      alt={selectedUser.username}
                      className="user-avatar"
                      onError={() => handleImageError(selectedUser.profilePicture)}
                    />
                    <span className={`status-indicator ${selectedUser.status}`}></span>
                  </div>
                  <span className="username">{selectedUser.username}</span>
                </div>
              </div>

              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div
                    key={msg._id || index}
                    className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">{msg.content}</div>
                    <div className="message-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="message-input" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="submit" disabled={!message.trim()}>Send</button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <h3>Select a user to start chatting</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectMessages;

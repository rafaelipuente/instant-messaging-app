import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import io from 'socket.io-client';
import '../styles/DirectMessages.css';

const DirectMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user?.token) {
      navigate('/login');
      return;
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
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      navigate('/login');
    });

    setSocket(newSocket);

    // Fetch initial users list
    fetchUsers();

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, [user?.token]);

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
      const filteredUsers = data.filter(u => u._id !== user._id);
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

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

      // Update active chats
      const otherUser = users.find(u => u._id === otherUserId);
      if (otherUser) {
        setActiveChats(prev => {
          if (!prev.find(chat => chat._id === otherUserId)) {
            return [...prev, otherUser];
          }
          return prev;
        });
      }
    });

    return () => {
      socket.off('newDirectMessage');
      socket.off('userConnected');
      socket.off('userDisconnected');
    };
  }, [socket, user, selectedUser, users]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUserSelect = async (clickedUser) => {
    setSelectedUser(clickedUser);
    setMessages([]); // Clear messages while loading

    try {
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

      // Add to active chats
      setActiveChats(prev => {
        if (!prev.find(chat => chat._id === clickedUser._id)) {
          return [...prev, clickedUser];
        }
        return prev;
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;

    try {
      socket.emit('directMessage', {
        content: message,
        receiverId: selectedUser._id
      });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
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
                  <img
                    src={user.profilePicture || '/default-avatar.png'}
                    alt={user.username}
                    className="user-avatar"
                  />
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
              {activeChats.map(user => (
                <div
                  key={user._id}
                  className={`user-item ${selectedUser?._id === user._id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <img
                    src={user.profilePicture || '/default-avatar.png'}
                    alt={user.username}
                    className="user-avatar"
                  />
                  <span className="username">{user.username}</span>
                </div>
              ))}
              {activeChats.length === 0 && (
                <div className="no-users">No active chats</div>
              )}
            </div>
          </div>
        </div>

        <div className="chat-section">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <h3>Chat with {selectedUser.username}</h3>
              </div>

              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      <div className="message-bubble">{msg.content}</div>
                      <div className="message-info">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="message-input-container">
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
              <h3>Welcome to Direct Messages</h3>
              <p>Select a user to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectMessages;

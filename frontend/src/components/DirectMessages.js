import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import '../styles/DirectMessages.css';

const DirectMessages = ({ socket }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  //const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket || !user) return;
    
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${SOCKET_URL}/api/users/list`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        console.log('Users received:', data.length);
        setUsers(data); // The backend already filtered out the current user
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [socket, user]);

  useEffect(() => {
    if (!socket || !selectedUser) return;

    socket.on('previousDMs', (messages) => {
      setMessages(messages);
      scrollToBottom();
    });

    socket.on('newDirectMessage', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    return () => {
      socket.off('previousDMs');
      socket.off('newDirectMessage');
    };
  }, [socket, selectedUser, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUserSelect = (selectedUser) => {
    if (selectedUser._id === user._id) {
      console.warn('Cannot message yourself');
      return;
    }
    setSelectedUser(selectedUser);
    socket.emit('joinDM', { userId: user._id, otherUserId: selectedUser._id });
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;

    // Another safety check before sending
    if (selectedUser._id === user._id) {
      console.warn('Cannot send message to yourself');
      return;
    }

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

  return (
    <div className="direct-messages">
      <div className="users-list">
        <div className="section-header">
          <h2>Direct Messages</h2>
        </div>
        {users.map((u) => (
          <div
            key={u._id}
            className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
            onClick={() => handleUserSelect(u)}
          >
            <img src={u.profilePicture || 'default-avatar.png'} alt={u.username} className="user-avatar" />
            <div className="user-info">
              <span className="user-name">{u.username}</span>
              <span className="user-status">{u.status || 'Online'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-section">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <h3>Chat with {selectedUser.username}</h3>
                <span className="user-status">{selectedUser.status || 'Online'}</span>
              </div>
            </div>
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}>
                  <div className="message-content">
                    <span className="message-text">{msg.content}</span>
                    <span className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
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
              <button type="submit" className="send-button">Send</button>
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
  );
};

export default DirectMessages;

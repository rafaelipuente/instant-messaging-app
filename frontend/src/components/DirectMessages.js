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
  const [typing, setTyping] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const fetchUsers = async () => {
      try {
        const response = await fetch(`${SOCKET_URL}/api/users/list`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await response.json();
        setUsers(data.filter(u => u._id !== user._id));
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [socket, user]);

  useEffect(() => {
    if (!socket || !selectedUser) return;

    console.log(`Joining DM with ${selectedUser.username}`);

    socket.emit('joinDM', {
      userId: user._id,
      otherUserId: selectedUser._id
    });

    const handlePreviousDMs = (messages) => {
      console.log("Received previous DMs:", messages);
      setMessages(messages);
      scrollToBottom();
    };

    const handleNewDM = (message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    const handleTyping = ({ username }) => {
      if (username !== user.username) {
        setTyping(username);
      }
    };

    const handleStopTyping = () => {
      setTyping(null);
    };

    socket.on('previousDMs', handlePreviousDMs);
    socket.on('newDirectMessage', handleNewDM);
    socket.on('userTyping', handleTyping);
    socket.on('userStopTyping', handleStopTyping);

    return () => {
      socket.off('previousDMs', handlePreviousDMs);
      socket.off('newDirectMessage', handleNewDM);
      socket.off('userTyping', handleTyping);
      socket.off('userStopTyping', handleStopTyping);
    };
  }, [socket, selectedUser, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUserSelect = (selectedUser) => {
    setSelectedUser(selectedUser);
    setMessages([]);
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (!socket || !selectedUser) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit('typing', {
      username: user.username,
      receiverId: selectedUser._id
    });

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId: selectedUser._id });
    }, 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket || !selectedUser) return;

    const newMessage = {
      sender: { _id: user._id, username: user.username },
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    socket.emit('directMessage', {
      content: message.trim(),
      receiverId: selectedUser._id
    });
  };

  return (
    <div className="direct-messages">
      <div className="users-list">
        <h2>Direct Messages</h2>
        {users.map(u => (
          <div
            key={u._id}
            className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
            onClick={() => handleUserSelect(u)}
          >
            <div className="user-avatar">
              {u.profilePicture ? (
                <img
                  src={u.profilePicture.startsWith('http') 
                    ? u.profilePicture 
                    : `${SOCKET_URL}${u.profilePicture}`}
                  alt={u.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.username)}&background=random`;
                  }}
                />
              ) : (
                <div className="avatar-placeholder">
                  {(u.name || u.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{u.name || u.username}</div>
              <div className={`user-status ${u.status || 'online'}`}>
                {u.status || 'Online'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>Chat with {selectedUser.name || selectedUser.username}</h3>
            </div>
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}
                >
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
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
          </>
        ) : (
          <div className="no-chat-selected">
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessages;

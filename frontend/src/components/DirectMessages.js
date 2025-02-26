import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import io from 'socket.io-client';
import '../styles/DirectMessages.css';
import UserAvatar from './UserAvatar';

function DirectMessages({ addNotification, addUnreadMessage }) {
  const { user, updateOpenChats, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState({});
  const [activeChats, setActiveChats] = useState([]);
  const [failedImages, setFailedImages] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [userTyping, setUserTyping] = useState(null);
  const messagesEndRef = useRef(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Function to fetch messages for a specific user
  const fetchUserMessages = useCallback(async (userId) => {
    if (!user?.token || !userId) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/messages/direct/${userId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const userMessages = await response.json();
      setMessages(prev => ({
        ...prev,
        [userId]: userMessages
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [user?.token]);

  // Function to handle image loading error
  const handleImageError = useCallback((src) => {
    if (src) {
      setFailedImages(prev => new Set([...prev, src]));
    }
  }, []);

  // Function to get profile picture URL
  const getProfilePictureUrl = useCallback((profilePicture) => {
    if (!profilePicture || failedImages.has(profilePicture)) {
      return null;
    }
    return `${SOCKET_URL}${profilePicture}`;
  }, [failedImages, SOCKET_URL]);

  // Fetch online users
  const fetchUsers = useCallback(async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/list`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [user?.token, SOCKET_URL]);

  // Fetch open chats
  const fetchOpenChats = useCallback(async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/users/open-chats`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch open chats');
      }

      const data = await response.json();
      setActiveChats(data);
      
      // Fetch messages for all open chats
      data.forEach(chat => {
        fetchUserMessages(chat._id);
      });
    } catch (error) {
      console.error('Error fetching open chats:', error);
    }
  }, [user?.token, fetchUserMessages, SOCKET_URL]);

  // Function to add a user to open chats
  const addToOpenChats = useCallback(async (userId) => {
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
        setActiveChats(updatedChats);
        
        // Update open chats in auth context to persist across navigation
        const openChatIds = updatedChats.map(chat => chat._id);
        updateOpenChats(openChatIds);
        
        // Store in localStorage for additional persistence
        localStorage.setItem('openChats', JSON.stringify(openChatIds));
        
        // Fetch messages for the new chat
        fetchUserMessages(newChat._id);
      }
    } catch (error) {
      console.error('Error adding to open chats:', error);
    }
  }, [user?.token, activeChats, fetchUserMessages, updateOpenChats, SOCKET_URL]);

  // Function to remove a user from open chats
  const removeFromOpenChats = useCallback(async (userId) => {
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
      setActiveChats(updatedChats);
      
      // Update open chats in auth context to persist across navigation
      const openChatIds = updatedChats.map(chat => chat._id);
      updateOpenChats(openChatIds);
      
      // Update localStorage
      localStorage.setItem('openChats', JSON.stringify(openChatIds));
      
    } catch (error) {
      console.error('Error removing from open chats:', error);
    }
  }, [user?.token, activeChats, updateOpenChats, SOCKET_URL]);

  // Function to handle user selection
  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    await addToOpenChats(user._id);
  };

  // Function to handle message deletion
  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      if (window.confirm('Are you sure you want to delete this message?')) {
        console.log('Deleting message:', messageId);
        socket.emit('deleteMessage', { messageId });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, [socket]);

  // Function to handle message input change
  const handleInputChange = useCallback((e) => {
    setMessage(e.target.value);

    if (socket && selectedUser) {
      if (typingTimeout) clearTimeout(typingTimeout);

      socket.emit('typing', {
        channel: `${user._id}-${selectedUser._id}`,
        username: user.username
      });

      const timeout = setTimeout(() => {
        setIsTyping(false);
        socket.emit('stopTyping', {
          channel: `${user._id}-${selectedUser._id}`
        });
      }, 2000);

      setTypingTimeout(timeout);
    }
  }, [socket, selectedUser, typingTimeout, user]);

  // Function to handle sending a message
  const handleSendMessage = useCallback((e) => {
    e.preventDefault();
    if (message.trim() && socket && selectedUser) {
      socket.emit('directMessage', {
        content: message.trim(),
        receiverId: selectedUser._id
      });
      setMessage('');
    }
  }, [message, socket, selectedUser]);

  // Initialize socket connection and fetch data
  useEffect(() => {
    if (!user?.token) {
      navigate('/login');
      return;
    }

    // Initialize with open chats from localStorage if available
    const savedOpenChats = localStorage.getItem('openChats');
    if (savedOpenChats) {
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

    fetchUsers();
    fetchOpenChats();

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: user.token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (error.message === 'Authentication error') {
        logout();
        navigate('/login');
      }
    });

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [user?.token, navigate, fetchUsers, fetchOpenChats, updateOpenChats]);

  // Handle socket events for real-time updates
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = (message) => {
      console.log('Received new direct message:', message);
      
      // Add message to state
      setMessages(prev => {
        const userId = message.sender._id === user._id ? message.receiver._id : message.sender._id;
        const userMessages = [...(prev[userId] || [])];
        
        // Only add if not already in the list
        if (!userMessages.find(msg => msg._id === message._id)) {
          userMessages.push(message);
        }
        
        return {
          ...prev,
          [userId]: userMessages
        };
      });

      // Create notification if message is from someone else and not the currently selected user
      if (message.sender._id !== user._id && (!selectedUser || selectedUser._id !== message.sender._id)) {
        // Add to unread messages
        addUnreadMessage(message.sender._id, message._id);
        
        // Create notification
        addNotification({
          id: message._id,
          type: 'directMessage',
          senderId: message.sender._id,
          sender: message.sender.username,
          senderAvatar: message.sender.profilePicture,
          message: `${message.sender.username} sent you a message: ${message.content.substring(0, 30)}${message.content.length > 30 ? '...' : ''}`,
          timestamp: message.timestamp,
          read: false
        });

        // Automatically open a DM window for the sender
        const senderUser = users.find(u => u._id === message.sender._id) || 
                          activeChats.find(c => c._id === message.sender._id);
        
        if (senderUser) {
          // Add to active chats if not already there
          if (!activeChats.find(chat => chat._id === senderUser._id)) {
            addToOpenChats(senderUser._id);
          }
        } else {
          // If we don't have the user info, fetch it and then open the chat
          fetch(`${SOCKET_URL}/api/users/${message.sender._id}`, {
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          })
          .then(response => response.json())
          .then(userData => {
            addToOpenChats(userData._id);
          })
          .catch(error => {
            console.error('Error fetching user data:', error);
          });
        }
      }
      
      // Scroll to bottom if the message is in the current chat
      if (selectedUser && 
          ((message.sender._id === selectedUser._id && message.receiver._id === user._id) || 
           (message.sender._id === user._id && message.receiver._id === selectedUser._id))) {
        setTimeout(scrollToBottom, 0);
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      // Mark message as deleted first (for animation)
      setMessages(prev => {
        const newMessages = { ...prev };
        
        // Find which chat contains this message and mark it for deletion
        Object.keys(newMessages).forEach(userId => {
          const msgIndex = newMessages[userId]?.findIndex(msg => msg._id === messageId);
          if (msgIndex !== -1 && msgIndex !== undefined) {
            // Create a shallow copy of the messages array
            newMessages[userId] = [...newMessages[userId]];
            // Mark the message as being deleted (for animation)
            newMessages[userId][msgIndex] = {
              ...newMessages[userId][msgIndex],
              isDeleting: true
            };
          }
        });
        
        return newMessages;
      });
      
      // Remove message after animation
      setTimeout(() => {
        setMessages(prev => {
          const newMessages = { ...prev };
          
          // Find which chat contains this message and remove it
          Object.keys(newMessages).forEach(userId => {
            newMessages[userId] = newMessages[userId]?.filter(msg => msg._id !== messageId) || [];
          });
          
          return newMessages;
        });
      }, 500); // Match this with the CSS animation duration
    };

    const handleTyping = ({ channel, username }) => {
      if (selectedUser && channel === `${selectedUser._id}-${user._id}`) {
        setUserTyping(username);
      }
    };

    const handleStopTyping = ({ channel }) => {
      if (selectedUser && channel === `${selectedUser._id}-${user._id}`) {
        setUserTyping(null);
      }
    };

    socket.on('newDirectMessage', handleNewMessage);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('userConnected', fetchUsers);
    socket.on('userDisconnected', fetchUsers);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('messageError', error => {
      console.error('Message error:', error);
      alert(`Error: ${error.error}`);
    });

    return () => {
      socket.off('newDirectMessage');
      socket.off('messageDeleted');
      socket.off('userConnected');
      socket.off('userDisconnected');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('messageError');
    };
  }, [socket, user, selectedUser, addToOpenChats, scrollToBottom, fetchUsers, addNotification, addUnreadMessage]);

  return (
    <div className="direct-messages">
      <div className="direct-messages-container">
        <div className="users-list">
          <div className="private-messages-header">
            <h2>Private Messages</h2>
          </div>

          <div className="section">
            <h3>All Users</h3>
            <div className="users-container">
              {users.map((u) => (
                <div
                  key={u._id}
                  className={`user-item ${selectedUser?._id === u._id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  <UserAvatar
                    profilePicture={getProfilePictureUrl(u.profilePicture)}
                    username={u.username}
                    status={users.some(online => online._id === u._id) ? 'online' : 'offline'}
                    onError={() => handleImageError(u.profilePicture)}
                  />
                  <span className="username">{u.username}</span>
                </div>
              ))}
              {users.length === 0 && (
                <div className="no-users">No users</div>
              )}
            </div>
          </div>

          <div className="section">
            <h3>Open DMs</h3>
            <div className="users-container">
              {activeChats.map((chat) => (
                <div
                  key={chat._id}
                  className={`user-item ${selectedUser?._id === chat._id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(chat)}
                >
                  <div className="user-item-content">
                    <UserAvatar
                      profilePicture={getProfilePictureUrl(chat.profilePicture)}
                      username={chat.username}
                      status={users.some(online => online._id === chat._id) ? 'online' : 'offline'}
                      onError={() => handleImageError(chat.profilePicture)}
                    />
                    <span className="username">{chat.username}</span>
                  </div>
                  <span
                    className="close-chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromOpenChats(chat._id);
                    }}
                    title="Close chat"
                  >
                    ×
                  </span>
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
                    <UserAvatar
                      profilePicture={getProfilePictureUrl(selectedUser.profilePicture)}
                      username={selectedUser.username}
                      status={users.some(online => online._id === selectedUser._id) ? 'online' : 'offline'}
                      onError={() => handleImageError(selectedUser.profilePicture)}
                    />
                  </div>
                  <span className="username">{selectedUser.username}</span>
                  {userTyping && <span className="typing">{userTyping} is typing...</span>}
                </div>
              </div>

              <div className="messages-container">
                {messages[selectedUser._id]?.map((msg, index) => (
                  <div
                    key={msg._id || index}
                    className={`message ${msg.sender._id === user._id ? 'sent' : 'received'} ${msg.isDeleting ? 'deleting' : ''}`}
                  >
                    <div className="message-wrapper">
                      <div className="message-header">
                        <span className="message-sender">
                          {msg.sender.username}
                        </span>
                        {msg.sender._id === user._id && !msg.isDeleting && (
                          <span 
                            className="delete-message"
                            onClick={() => handleDeleteMessage(msg._id)}
                            title="Delete message"
                          >
                            🗑️
                          </span>
                        )}
                      </div>
                      <div className="message-content">
                        {msg.content}
                      </div>
                      <div className="message-timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input">
                <form onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={handleInputChange}
                  />
                  <button type="submit" disabled={!message.trim()}>Send</button>
                </form>
                {userTyping && (
                  <div className="typing-indicator">
                    {userTyping} is typing...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Select a user to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DirectMessages;

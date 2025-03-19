import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../context/MessageContext';
import { useSocket } from '../context/SocketContext';
import { SOCKET_URL } from '../config';
import '../styles/DirectMessages.css';

const DirectMessages = () => {
  const { socket } = useSocket();
  const { user, getFullProfilePictureUrl } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [showOnlineUsers, setShowOnlineUsers] = useState(true);
  const [showOfflineUsers, setShowOfflineUsers] = useState(true);
  const [showConversations, setShowConversations] = useState(true);
  const [recentConversations, setRecentConversations] = useState([]);

  // Fetch users and listen for user updates
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
        const processedData = data.map(u => ({
          ...u,
          profilePicture: getFullProfilePictureUrl(u.profilePicture)
        }));
        setUsers(processedData);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();

    socket.on('userUpdated', (updatedUser) => {
      setUsers(prevUsers => prevUsers.map(u => {
        if (u._id === updatedUser._id) {
          return {
            ...updatedUser,
            profilePicture: getFullProfilePictureUrl(updatedUser.profilePicture)
          };
        }
        return u;
      }));

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
  }, [socket, user, getFullProfilePictureUrl, selectedUser]);

  // Simple message handling for selected user - following the friend's pattern
  useEffect(() => {
    if (!socket || !selectedUser) return;

    // Join DM room when selected user changes
    socket.emit('joinDM', { userId: user._id, otherUserId: selectedUser._id });

    // Load previous messages
    socket.on('previousDMs', (messages) => {
      setMessages(messages);
      setTimeout(scrollToBottom, 0);
    });

    // Listen for new messages using friend's simplified pattern
    socket.on('newDirectMessage', (message) => {
      console.log("Received message via WebSocket:", message);
      console.log("Current selected user ID:", selectedUser._id);
      
      // Only add message if it involves the selected user
      const senderIsSelected = message.sender._id === selectedUser._id;
      const receiverIsSelected = message.receiver._id === selectedUser._id;
      
      if (senderIsSelected || receiverIsSelected) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
    });
    
    // Handle message deletion
    socket.on('messageDeleted', (messageId) => {
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    });

    return () => {
      socket.off('previousDMs');
      socket.off('newDirectMessage');
      socket.off('messageDeleted');
    };
  }, [socket, user, selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  };



  const handleBack = () => {
    window.location.href = '/chat';
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;

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
  
  const { deleteMessage } = useMessages();
  
  const handleDeleteMessage = (messageId) => {
    if (!messageId) return;
    
    try {
      deleteMessage(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Add a user to recent conversations when selected
  const handleUserSelect = (selectedUser) => {
    if (selectedUser._id === user._id) {
      console.warn('Cannot message yourself');
      return;
    }
    
    setSelectedUser(selectedUser);
    setMessages([]); // Clear messages when switching users
    socket.emit('joinDM', { userId: user._id, otherUserId: selectedUser._id });
    
    // Add to recent conversations if not already there
    setRecentConversations(prev => {
      const exists = prev.some(conv => conv._id === selectedUser._id);
      if (!exists) {
        return [selectedUser, ...prev.slice(0, 4)]; // Keep only the 5 most recent conversations
      }
      return prev;
    });
  };
  
  // Remove a conversation from the recent list
  const removeConversation = (e, conversationId) => {
    e.stopPropagation(); // Prevent triggering the conversation selection
    setRecentConversations(prev => prev.filter(conv => conv._id !== conversationId));
    
    // If the currently selected conversation is removed, clear the selection
    if (selectedUser && selectedUser._id === conversationId) {
      setSelectedUser(null);
      setMessages([]);
    }
  };

  return (
    <div className="direct-messages">
      <div className="users-list">
        <button className="back-button" onClick={handleBack}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Private Messages</span>
        </button>
        <div className="section-header">
          <h2>Private Messages</h2>
        </div>
        
        {/* Recent Conversations */}
        <div 
          className="user-group-header clickable" 
          onClick={() => setShowConversations(!showConversations)}
        >
          <span>Recent Conversations</span>
          <span className="toggle-icon">{showConversations ? '−' : '+'}</span>
        </div>
        
        {showConversations && recentConversations.length > 0 ? (
          <div className="user-group">
            {recentConversations.map((u) => (
              <div
                key={u._id}
                className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                onClick={() => handleUserSelect(u)}
              >
                <div className="user-avatar">
                  {u.profilePicture ? (
                    <img 
                      src={u.profilePicture} 
                      alt={u.username}
                      className="user-avatar-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`;
                      }}
                    />
                  ) : (
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`}
                      alt={u.username}
                      className="user-avatar-image"
                    />
                  )}
                </div>
                <div className="user-info">
                  <span className="user-name">{u.username}</span>
                  <span className="user-status">{u.status || 'offline'}</span>
                </div>
                <button 
                  className="remove-conversation-btn" 
                  onClick={(e) => removeConversation(e, u._id)}
                  title="Remove from recent conversations"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : showConversations && (
          <div className="empty-group-message">No recent conversations</div>
        )}
        
        {/* Online Users */}
        <div 
          className="user-group-header clickable" 
          onClick={() => setShowOnlineUsers(!showOnlineUsers)}
        >
          <span>Online Users</span>
          <span className="toggle-icon">{showOnlineUsers ? '−' : '+'}</span>
        </div>
        
        {showOnlineUsers && users.filter(u => u.status === 'online' && u._id !== user._id).length > 0 ? (
          <div className="user-group">
            {users
              .filter(u => u.status === 'online' && u._id !== user._id)
              .map((u) => (
                <div
                  key={u._id}
                  className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  <div className="user-avatar">
                    {u.profilePicture ? (
                      <img 
                        src={u.profilePicture} 
                        alt={u.username}
                        className="user-avatar-image"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`;
                        }}
                      />
                    ) : (
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`}
                        alt={u.username}
                        className="user-avatar-image"
                      />
                    )}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{u.username}</span>
                    <span className="user-status">{u.status || 'offline'}</span>
                  </div>
                </div>
              ))}
          </div>
        ) : showOnlineUsers && (
          <div className="empty-group-message">No users online</div>
        )}
        
        {/* Offline Users */}
        <div 
          className="user-group-header clickable" 
          onClick={() => setShowOfflineUsers(!showOfflineUsers)}
        >
          <span>Offline Users</span>
          <span className="toggle-icon">{showOfflineUsers ? '−' : '+'}</span>
        </div>
        
        {showOfflineUsers && users.filter(u => u.status !== 'online' && u._id !== user._id).length > 0 ? (
          <div className="user-group">
            {users
              .filter(u => u.status !== 'online' && u._id !== user._id)
              .map((u) => (
                <div
                  key={u._id}
                  className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  <div className="user-avatar">
                    {u.profilePicture ? (
                      <img 
                        src={u.profilePicture} 
                        alt={u.username}
                        className="user-avatar-image"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`;
                        }}
                      />
                    ) : (
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random&color=fff&size=128`}
                        alt={u.username}
                        className="user-avatar-image"
                      />
                    )}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{u.username}</span>
                    <span className="user-status">{u.status || 'offline'}</span>
                  </div>
                </div>
              ))}
          </div>
        ) : showOfflineUsers && (
          <div className="empty-group-message">No offline users</div>
        )}
        
        {selectedUser && (
          <button className="clear-selection-button" onClick={() => setSelectedUser(null)}>
            Clear Selection
          </button>
        )}
      </div>

      <div className="chat-section">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <h3>Chat with {selectedUser.username}</h3>
                <span className="user-status">{selectedUser.status || 'offline'}</span>
              </div>
            </div>
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div 
                  key={msg._id || index} 
                  className={`message ${msg.sender._id === user._id ? 'sent' : 'received'} ${msg.isDeleted ? 'deleted' : ''} ${msg.deleting ? 'deleting' : ''}`}
                >
                  <div className="message-content">
                    <div className="message-text-container">
                      <div className="message-text">
                        {msg.deleting ? 'Deleting...' : msg.content}
                      </div>
                      {msg.sender._id === user._id && !msg.isDeleted && !msg.deleting && (
                        <button 
                          className="delete-message-btn" 
                          onClick={() => handleDeleteMessage(msg._id)}
                          aria-label="Delete message"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </div>
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
              <button type="submit" className="send-button">
                Send
              </button>
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

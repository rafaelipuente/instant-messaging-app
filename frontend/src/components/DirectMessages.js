import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import io from 'socket.io-client';
import '../styles/DirectMessages.css';
import UserAvatar from './UserAvatar';
import toast from 'react-hot-toast'; // Import toast

function DirectMessages({ addNotification, addUnreadMessage, socketProp }) {
  const { user, updateOpenChats, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [failedImages, setFailedImages] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [userTyping, setUserTyping] = useState(null);
  const [socket, setSocket] = useState(socketProp);
  const messagesEndRef = useRef(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Function to fetch messages for a specific user
  const fetchUserMessages = useCallback(async (userId) => {
    if (!user?.token || !userId || !socket) return;

    // Load messages through socket instead of REST API
    socket.emit('loadInitialMessages', { userId });
  }, [user?.token, socket]);

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
      }
    } catch (error) {
      console.error('Error adding to open chats:', error);
    }
  }, [user?.token, activeChats, updateOpenChats, SOCKET_URL]);

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
  const handleUserSelect = async (selectedUser) => {
    setSelectedUser(selectedUser);
    await addToOpenChats(selectedUser._id);
    
    // Load messages through socket
    if (socket) {
      socket.emit('loadInitialMessages', { userId: selectedUser._id });
    }
  };

  // Function to handle message deletion
  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      console.log('[Frontend] Attempting to delete message:', messageId);
      console.log('[Frontend] Current user:', user._id);
      
      if (!messageId) {
        console.error('[Frontend] Error: No message ID provided');
        toast.error('Cannot delete message: Missing message ID');
        return;
      }
      
      // Ensure messageId is a string (not an object reference)
      const messageIdStr = messageId.toString();
      
      // Find the message in our current state to log its details
      const messageToDelete = messages.find(msg => msg._id === messageIdStr);
      if (messageToDelete) {
        console.log('[Frontend] Message details:', JSON.stringify({
          id: messageToDelete._id,
          sender: messageToDelete.sender._id,
          content: messageToDelete.content.substring(0, 20) + '...',
          timestamp: messageToDelete.timestamp
        }));
        
        // Verify that the current user is the sender
        if (messageToDelete.sender._id !== user._id) {
          console.error('[Frontend] Error: User not authorized to delete this message');
          toast.error('You can only delete your own messages');
          return;
        }
      } else {
        console.log('[Frontend] Warning: Message not found in local state');
      }
      
      if (window.confirm('Are you sure you want to delete this message?')) {
        console.log('[Frontend] Deletion confirmed for message:', messageIdStr);
        
        // Mark message as deleting for visual feedback
        setMessages(prev => 
          prev.map(msg => 
            msg._id === messageIdStr 
              ? { ...msg, isDeleting: true } 
              : msg
          )
        );
        
        // Send deletion request with string ID
        console.log('[Frontend] Emitting deleteMessage event with ID:', messageIdStr);
        socket.emit('deleteMessage', { messageId: messageIdStr });
      }
    } catch (error) {
      console.error('[Frontend] Error deleting message:', error);
      toast.error('Failed to delete message: ' + (error.message || 'Unknown error'));
      
      // Revert deleting status if there's an error
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, isDeleting: false } 
            : msg
        )
      );
    }
  }, [socket, messages, user._id, toast]);

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
      console.log('Sending direct message to:', selectedUser._id);
      
      // Emit the message through socket
      socket.emit('directMessage', {
        content: message.trim(),
        receiverId: selectedUser._id
      });
      
      // Add message to state immediately for better UX
      const newMessage = {
        _id: Date.now().toString(), // Temporary ID until server responds
        content: message.trim(),
        sender: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        receiver: {
          _id: selectedUser._id,
          username: selectedUser.username,
          profilePicture: selectedUser.profilePicture
        },
        timestamp: new Date(),
        messageType: 'direct'
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      setTimeout(scrollToBottom, 0);
    }
  }, [message, socket, selectedUser, user, scrollToBottom]);

  // Set up socket connection
  useEffect(() => {
    if (!user?.token) {
      navigate('/login');
      return;
    }

    // Set initial open chats from user data
    if (user.openChats) {
      setActiveChats(user.openChats);
    }

    // Initialize socket connection if not provided as prop
    let newSocket = socket;
    if (!newSocket) {
      newSocket = io(SOCKET_URL, {
        auth: { token: user.token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5
      });

      newSocket.on('connect', () => {
        console.log('Socket connected successfully for DMs');
        setSocket(newSocket);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        navigate('/login');
      });
    } else {
      setSocket(newSocket);
    }

    // Set up socket event listeners
    if (newSocket) {
      // Listen for new direct messages
      newSocket.on('newDirectMessage', (message) => {
        console.log('New direct message received:', message);
        
        // Update messages if this is from the currently selected user
        if (selectedUser && 
            (message.sender._id === selectedUser._id || message.receiver._id === selectedUser._id)) {
          setMessages(prev => [...prev, message]);
          setTimeout(scrollToBottom, 0);
        }
        
        // Add sender to open chats if not already there
        if (message.sender._id !== user._id) {
          addToOpenChats(message.sender._id);
        }
      });

      // Listen for previous messages
      newSocket.on('previousMessages', (messages) => {
        console.log('Received previous messages:', messages.length);
        setMessages(messages);
        setTimeout(scrollToBottom, 0);
      });

      // Fetch users and open chats
      fetchUsers();
      if (!user.openChats) {
        fetchOpenChats();
      }
    }

    return () => {
      // Only disconnect if we created the socket
      if (newSocket && !socketProp) {
        console.log('Cleaning up socket connection');
        newSocket.disconnect();
      }
    };
  }, [user?.token, socketProp]);

  // Handle socket events for real-time updates
  useEffect(() => {
    if (!socket || !user) return;

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

    const handleMessageDeleted = ({ messageId }) => {
      console.log('[Frontend] Message deleted event received:', messageId);
      
      // Ensure messageId is a string
      const messageIdStr = String(messageId).trim();
      
      setMessages(prev => {
        console.log('[Frontend] Current messages count:', prev.length);
        console.log('[Frontend] Message IDs in state:', prev.map(m => m._id).join(', '));
        return prev.filter(msg => String(msg._id) !== messageIdStr);
      });
    };

    const handleMessageDeleteSuccess = ({ messageId }) => {
      console.log('[Frontend] Message delete success event received:', messageId);
      // Message already marked as deleted in the handleMessageDeleted handler
    };

    const handleMessageError = ({ error }) => {
      console.error('[Frontend] Message error event received:', error);
      // Revert any messages marked as deleting
      setMessages(prev => 
        prev.map(msg => {
          if (msg.isDeleting) {
            console.log('[Frontend] Reverting deleting status for message:', msg._id);
            return { ...msg, isDeleting: false };
          }
          return msg;
        })
      );
      // Show error to user
      toast.error(error || 'An error occurred with your message');
    };

    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageDeleteSuccess', handleMessageDeleteSuccess);
    socket.on('messageError', handleMessageError);

    return () => {
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('messageDeleted');
      socket.off('messageDeleteSuccess');
      socket.off('messageError');
    };
  }, [socket, user, selectedUser]);

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
                {messages.map((msg, index) => (
                  <div
                    key={msg._id || index}
                    className={`message ${msg.sender._id === user._id ? 'sent' : 'received'} ${msg.isDeleting ? 'deleting' : ''}`}
                  >
                    <div className="message-wrapper">
                      <div className="message-header">
                        <span className="message-sender">
                          {msg.sender.username}
                        </span>
                        {msg.sender._id === user._id && (
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

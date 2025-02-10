import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import '../styles/DirectMessages.css';

const DirectMessages = ({ socket }) => {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch users and conversations
  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch users
      const usersResponse = await axios.get(`${API_BASE_URL}/users/all-users`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      const filteredUsers = usersResponse.data.filter(u => u._id !== user._id);
      setUsers(filteredUsers);

      // Fetch conversations
      await fetchConversations();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dm/conversations`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (!selectedChat) return;
    
    // Join the conversation room for real-time updates
    socket.emit('join conversation', { conversationId: selectedChat._id });
    
    fetchMessages(selectedChat._id);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [selectedChat]);

  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/dm/${conversationId}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setMessages(response.data);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('receive message', (message) => {
      if (selectedChat && message.conversationId === selectedChat._id) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      }
      fetchConversations();
    });

    socket.on('userTyping', ({ username }) => {
      if (username !== user.username) {
        setTypingUser(username);
        setIsTyping(true);
      }
    });

    socket.on('userStopTyping', () => {
      setTypingUser(null);
      setIsTyping(false);
    });

    return () => {
      socket.off('receive message');
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [socket, selectedChat]);

  const handleMessageChange = (e) => {
    setNewMessage(e.target.value);

    if (!selectedChat) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing event
    socket.emit('typing', {
      conversationId: selectedChat._id,
      username: user.username
    });

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', {
        conversationId: selectedChat._id
      });
    }, 1000);
  };

  const startChat = async (otherUser) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/dm/start`,
        { otherUserId: otherUser._id },
        { headers: { Authorization: `Bearer ${user.token}` }}
      );
      
      const { conversationId } = response.data;
      
      // Find existing conversation or create new one
      let conversation = conversations.find(c => c._id === conversationId);
      if (!conversation) {
        conversation = {
          _id: conversationId,
          participants: [user, otherUser]
        };
        setConversations(prev => [...prev, conversation]);
      }
      
      setSelectedChat(conversation);
      fetchMessages(conversationId);
    } catch (error) {
      console.error('Error starting chat:', error);
      alert('Failed to start chat. Please try again.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/dm/${selectedChat._id}/messages`,
        { content: newMessage },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      scrollToBottom();

      // Emit the message through socket
      socket.emit('new message', {
        conversationId: selectedChat._id,
        message: response.data
      });

      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="direct-messages-container">
      <div className="sidebar">
        <div className="users-section">
          <h3>All Users</h3>
          <div className="users-list">
            {users.map(otherUser => (
              <div
                key={otherUser._id}
                className="user-item"
                onClick={() => startChat(otherUser)}
              >
                <div className="user-avatar">
                  {otherUser.username[0].toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="username">{otherUser.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="conversations-section">
          <h3>Conversations</h3>
          <div className="conversations-list">
            {conversations.map(chat => (
              <div
                key={chat._id}
                className={`conversation-item ${selectedChat?._id === chat._id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedChat(chat);
                  fetchMessages(chat._id);
                }}
              >
                <div className="conversation-avatar">
                  {chat.participants.find(p => p._id !== user._id)?.username[0].toUpperCase()}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {chat.participants.find(p => p._id !== user._id)?.username}
                  </div>
                  {chat.lastMessage && (
                    <div className="last-message">
                      {new Date(chat.lastMessage).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="chat-area">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="chat-avatar">
                  {selectedChat.participants.find(p => p._id !== user._id)?.username[0].toUpperCase()}
                </div>
                <div className="chat-username">
                  {selectedChat.participants.find(p => p._id !== user._id)?.username}
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.sender._id === user._id ? 'sent' : 'received'}`}
                >
                  <div className="message-content">{message.content}</div>
                  <div className="message-timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {isTyping && typingUser && (
                <div className="typing-indicator">
                  {typingUser} is typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="message-input-container">
              <input
                type="text"
                value={newMessage}
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

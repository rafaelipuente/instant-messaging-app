import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import io from 'socket.io-client';
import '../styles/Chat.css';

const SOCKET_SERVER = 'http://localhost:5001';

const Chat = () => {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState('General');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [typing, setTyping] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const channels = [
    { id: 'general', name: 'General', icon: '🌐' },
    { id: 'tech', name: 'Tech Talk', icon: '💻' },
    { id: 'random', name: 'Random', icon: '🎲' },
    { id: 'music', name: 'Music', icon: '🎵' }
  ];

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Join channel and load messages
  useEffect(() => {
    if (socket && user) {
      // Join the channel
      socket.emit('join', { userId: user._id, channel: activeChannel });

      // Listen for previous messages
      socket.on('previousMessages', (previousMessages) => {
        setMessages(previousMessages);
      });

      // Listen for new messages
      socket.on('message', (newMessage) => {
        setMessages(prev => [...prev, newMessage]);
      });

      // Listen for typing events
      socket.on('userTyping', ({ username }) => {
        if (username !== user.username) {
          setTyping(username);
        }
      });

      socket.on('userStopTyping', () => {
        setTyping(null);
      });

      // Cleanup listeners when changing channels
      return () => {
        socket.off('previousMessages');
        socket.off('message');
        socket.off('userTyping');
        socket.off('userStopTyping');
      };
    }
  }, [socket, activeChannel, user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleChannelChange = (channel) => {
    setActiveChannel(channel);
    setMessages([]);
    if (socket) {
      socket.emit('join', { userId: user._id, channel });
    }
  };

  const emitTyping = () => {
    if (socket) {
      socket.emit('typing', { channel: activeChannel, username: user.username });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', { channel: activeChannel });
      }, 1000);
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    emitTyping();
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    // Emit message to server
    socket.emit('message', {
      content: message.trim(),
      channel: activeChannel
    });

    // Clear input and typing status
    setMessage('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit('stopTyping', { channel: activeChannel });
    }
  };

  return (
    <div className="chat-container">
      <Navbar />
      
      <div className="chat-content">
        <div className="channels-sidebar">
          <h2>Channels</h2>
          <div className="channel-list">
            {channels.map(channel => (
              <button
                key={channel.id}
                className={`channel-item ${activeChannel === channel.name ? 'active' : ''}`}
                onClick={() => handleChannelChange(channel.name)}
              >
                <span className="channel-icon">{channel.icon}</span>
                {channel.name}
              </button>
            ))}
          </div>
        </div>

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
                <div className="message-header">
                  <span className="message-sender">{msg.sender.name || msg.sender.username}</span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">{msg.content}</div>
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
              placeholder={`Message #${activeChannel}`}
              className="message-input"
            />
            <button type="submit" className="send-button">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;

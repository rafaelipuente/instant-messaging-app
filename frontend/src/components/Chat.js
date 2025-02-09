import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';
import '../styles/Chat.css';

const SOCKET_SERVER = 'http://localhost:5001';

const CHAT_ROOMS = [
  { id: 'general', name: 'General', icon: '💬' },
  { id: 'tech', name: 'Tech Talk', icon: '💻' },
  { id: 'random', name: 'Random', icon: '🎲' },
  { id: 'music', name: 'Music', icon: '🎵' }
];

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(CHAT_ROOMS[0]);
  const messagesEndRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER);
    setSocket(newSocket);
    newSocket.emit('join', currentRoom.id);

    // Listen for new messages
    newSocket.on('message', (message) => {
      if (typeof message === 'object' && message !== null) {
        setMessages(prevMessages => [...prevMessages, {
          ...message,
          sender: message.sender?.username || message.sender
        }]);
      }
    });

    // Listen for previous messages when joining a room
    newSocket.on('previous-messages', (previousMessages) => {
      if (Array.isArray(previousMessages)) {
        const formattedMessages = previousMessages.map(msg => ({
          ...msg,
          sender: msg.sender?.username || msg.sender
        }));
        setMessages(formattedMessages);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      socket.emit('join', currentRoom.id);
    }
  }, [currentRoom.id, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      const messageData = {
        room: currentRoom.id,
        content: newMessage,
        sender: user.username,
        timestamp: new Date().toISOString()
      };

      socket.emit('message', messageData);
      setNewMessage('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  };

  const handleRoomChange = (room) => {
    setCurrentRoom(room);
    setMessages([]); // Clear messages when changing rooms
  };

  return (
    <div className="chat-container">
      <div className="chat-rooms">
        {CHAT_ROOMS.map(room => (
          <button
            key={room.id}
            onClick={() => handleRoomChange(room)}
            className={`room-button ${currentRoom.id === room.id ? 'active' : ''}`}
          >
            <span className="room-icon">{room.icon}</span>
            <span className="room-name">{room.name}</span>
          </button>
        ))}
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => {
          const isCurrentUser = msg.sender === user.username;
          return (
            <div
              key={msg._id || index}
              className={`message ${isCurrentUser ? 'sent' : 'received'}`}
            >
              <div className="message-sender">{msg.sender}</div>
              <div className="message-content">
                <div className="message-text">{msg.content}</div>
              </div>
              <div className="message-time">
                {formatTime(msg.timestamp)}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Message ${currentRoom.name}`}
          className="chat-input"
          autoComplete="off"
        />
        <button type="submit" className="chat-send-button">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default Chat;

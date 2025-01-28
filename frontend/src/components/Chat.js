import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import '../styles/Chat.css';

const socket = io('http://localhost:5000'); // Adjust if needed

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('General');

  const messagesEndRef = useRef(null);
  const authUser = JSON.parse(localStorage.getItem('authUser'));

  // Join room + listeners
  useEffect(() => {
    socket.emit('joinRoom', room);

    socket.on('loadMessages', (oldMessages) => setMessages(oldMessages));
    socket.on('message', (data) => setMessages((prev) => [...prev, data]));

    return () => {
      socket.off('loadMessages');
      socket.off('message');
    };
  }, [room]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (message.trim() === '') return;
    const user = authUser?.name || 'Anonymous';
    socket.emit('message', { room, user, message });
    setMessage('');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1 className="color-cycle">Chat Room</h1>
      </div>

      <div className="room-selector">
        <label htmlFor="roomSelect">Choose a room:</label>
        <select
          id="roomSelect"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        >
          <option value="General">General</option>
          <option value="Sports">Sports</option>
          <option value="Tech">Tech</option>
        </select>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <p key={idx} className={msg.user === authUser?.name ? 'self' : ''}>
            <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;

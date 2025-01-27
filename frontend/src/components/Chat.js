import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import '../styles/Chat.css'; // Make sure this path is correct for your project

const socket = io('http://localhost:5000'); // Your backend's WebSocket URL

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('General');

  const messagesEndRef = useRef(null);
  const authUser = JSON.parse(localStorage.getItem('authUser'));

  // 1) Join the room and set up listeners whenever `room` changes
  useEffect(() => {
    socket.emit('joinRoom', room);

    socket.on('loadMessages', (oldMessages) => {
      setMessages(oldMessages);
    });

    socket.on('message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off('loadMessages');
      socket.off('message');
    };
  }, [room]);

  // 2) Auto-scroll to the bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 3) Send a new message
  const sendMessage = () => {
    if (message.trim() === '') return;

    const user = authUser?.name || 'Anonymous';
    const newMessage = { room, user, message };
    socket.emit('message', newMessage);
    setMessage('');
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        
        {/* Header */}
        <div className="chat-header">
          {/* "color-cycle" class handles the animated color change in Chat.css */}
          <h1 className="color-cycle">Chat Room</h1>
        </div>

        {/* Room Selector */}
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

        {/* Messages Container */}
        <div className="chat-messages">
          {messages.map((msg, index) => (
            /* If you want your own messages styled differently, you could do:
               className={msg.user === authUser?.name ? 'self' : ''}
            */
            <p key={index}>
              <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
            </p>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Send Button */}
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
    </div>
  );
};

export default Chat;

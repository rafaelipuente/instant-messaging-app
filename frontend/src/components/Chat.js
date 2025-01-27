import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';

const socket = io('http://localhost:5000');

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('General');
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const authUser = JSON.parse(localStorage.getItem('authUser'));

  // 1) Join the room and set up listeners
  useEffect(() => {
    // Each time 'room' changes, tell the server to join that room
    socket.emit('joinRoom', room);

    // When the server sends old messages for this room
    socket.on('loadMessages', (oldMessages) => {
      setMessages(oldMessages);
      console.log('Loaded messages:', oldMessages);
    });

    // When a new message is broadcast to this room
    socket.on('message', (data) => {
      console.log('Received new message:', data);
      setMessages((prev) => [...prev, data]);
    });

    // Cleanup: remove old listeners before re-running effect
    return () => {
      socket.off('loadMessages');
      socket.off('message');
    };
  }, [room]);

  // 2) Send a new message
  const sendMessage = () => {
    if (message.trim() === '') return;

    const user = authUser?.name || 'Anonymous';

    const newMessage = {
      room,
      user,
      message,
    };

    console.log('Sending message:', newMessage);
    socket.emit('message', newMessage);
    setMessage('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className="chat-container"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#2c2c2c',
        color: 'white',
        padding: '20px',
      }}
    >
      {/* Header */}
      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Chat Room</h1>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Logout
        </button>
      </div>

      {/* Room Selector */}
      <select
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        style={{ marginBottom: '10px', padding: '5px', borderRadius: '5px' }}
      >
        <option value="General">General</option>
        <option value="Sports">Sports</option>
        <option value="Tech">Tech</option>
      </select>

      {/* Messages Container */}
      <div
        className="chat-messages"
        style={{
          height: '80vh',
          overflowY: 'auto',
          border: '1px solid #444',
          padding: '10px',
          backgroundColor: '#333',
          flexGrow: 1,
          marginBottom: '10px',
        }}
      >
        {messages.map((msg, index) => (
          <p
            key={index}
            style={{
              margin: '5px 0',
              color: msg.user === authUser?.name ? '#1e90ff' : 'white',
            }}
          >
            <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Send Button */}
      <div className="chat-input" style={{ display: 'flex' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            width: '80%',
            padding: '10px',
            marginRight: '10px',
            border: '1px solid #444',
            borderRadius: '5px',
            backgroundColor: '#444',
            color: 'white',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '10px 15px',
            backgroundColor: '#1e90ff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;

import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';



const socket = io('http://localhost:5000'); // Your backend's WebSocket URL

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('General');

  const messagesEndRef = useRef(null);
  
  const authUser = JSON.parse(localStorage.getItem('authUser'));

  // Join the room and set up listeners whenever `room` changes
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

  // Send a new message
  const sendMessage = () => {
    if (message.trim() === '') return;

    const user = authUser?.name || 'Anonymous';
    const newMessage = { room, user, message };

    socket.emit('message', newMessage);
    setMessage('');
  };



  return (
    <div
      className="chat-container"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1f1f1f',
        color: '#f5f5f5',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header Area */}
      <div 
        className="chat-header" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px' }}>Chat Room</h1>
        
      </div>

      {/* Room Selector */}
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="roomSelect" style={{ marginRight: '8px', fontSize: '16px' }}>
          Choose a room:
        </label>
        <select
          id="roomSelect"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#333',
            color: 'white',
            fontSize: '16px',
          }}
        >
          <option value="General">General</option>
          <option value="Sports">Sports</option>
          <option value="Tech">Tech</option>
        </select>
      </div>

      {/* Messages Container */}
      <div
        className="chat-messages"
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          border: '1px solid #444',
          backgroundColor: '#2c2c2c',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '10px',
        }}
      >
        {messages.map((msg, index) => (
          <p
            key={index}
            style={{
              margin: '5px 0',
              color: msg.user === authUser?.name ? '#1e90ff' : '#f5f5f5',
              fontSize: '15px',
              lineHeight: '1.4',
            }}
          >
            <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Send Button */}
      <div 
        className="chat-input" 
        style={{ display: 'flex', marginTop: 'auto' }}
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #444',
            borderRadius: '4px',
            backgroundColor: '#333',
            color: 'white',
            fontSize: '16px',
            marginRight: '10px',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '10px 15px',
            backgroundColor: '#1e90ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;

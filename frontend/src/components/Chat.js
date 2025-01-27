import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

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

  // Send a new message
  const sendMessage = () => {
    if (message.trim() === '') return;

    const user = authUser?.name || 'Anonymous';
    const newMessage = { room, user, message };
    socket.emit('message', newMessage);
    setMessage('');
  };

  return (
    /**
     * .chat-page:
     *  - Takes entire viewport height (100vh).
     *  - Extra top padding (e.g., 80px) so we sit below the navbar.
     *  - display: flex => center the chat box horizontally & vertically.
     */
    <div
      className="chat-page"
      style={{
        height: '100vh',
        paddingTop: '80px', // adjust if navbar is taller/shorter
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1f1f1f',
        color: '#f5f5f5',
        margin: 0,
      }}
    >
      {/**
       * .chat-container:
       *  - A fixed width (maxWidth: 800px) so it's not too wide.
       *  - A set height so only the messages area will scroll if needed.
       *  - Rounded corners & a slightly darker background for contrast.
       */}
      <div
        className="chat-container"
        style={{
          width: '90%',
          maxWidth: '800px',
          height: '70vh', // adjust to taste (70% of window height)
          backgroundColor: '#2c2c2c',
          padding: '16px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Header / Title */}
        <div
          className="chat-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '22px' }}>Chat Room</h1>
        </div>

        {/* Room Selector */}
        <div style={{ marginBottom: '6px' }}>
          <label
            htmlFor="roomSelect"
            style={{ marginRight: '8px', fontSize: '15px' }}
          >
            Choose a room:
          </label>
          <select
            id="roomSelect"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #444',
              backgroundColor: '#333',
              color: 'white',
              fontSize: '15px',
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
            flexGrow: 1,          // fill remaining space
            overflowY: 'auto',    // scroll if messages exceed container height
            border: '1px solid #444',
            backgroundColor: '#3a3a3a',
            padding: '8px',
            borderRadius: '6px',
            marginBottom: '6px',
          }}
        >
          {messages.map((msg, index) => (
            <p
              key={index}
              style={{
                margin: '4px 0',
                color: msg.user === authUser?.name ? '#1e90ff' : '#f5f5f5',
                fontSize: '14px',
                lineHeight: '1.4',
              }}
            >
              <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
            </p>
          ))}

          {/* 3) This div is where we scroll to (the bottom) */}
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
              flex: 1,
              padding: '8px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#333',
              color: 'white',
              fontSize: '15px',
              marginRight: '6px',
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e90ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000'); // Backend WebSocket URL

const Chat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('General');

    useEffect(() => {
        console.log('Joining room:', room);
        socket.emit('joinRoom', room);

        // Load previous messages when joining the room
        socket.on('loadMessages', (loadedMessages) => {
            console.log('Loaded messages from server:', loadedMessages);
            setMessages(loadedMessages);
        });

        // Listen for new messages
        socket.on('message', (newMessage) => {
            console.log('Message received from server:', newMessage);
            setMessages((prev) => [...prev, newMessage]);
        });

        return () => {
            console.log('Leaving room:', room);
            socket.emit('leaveRoom', room);
            socket.off('loadMessages');
            socket.off('message'); // Clean up listeners
        };
    }, [room]);

    const sendMessage = () => {
        if (message.trim() === '') return;

        const newMessage = {
            room,
            user: 'User', // Replace with logged-in user data if available
            message,
        };

        console.log('Sending message:', newMessage);
        socket.emit('message', newMessage); // Emit message to backend
        setMessage('');
    };

    return (
        <div style={{ maxWidth: '600px', margin: 'auto', padding: '20px' }}>
            <h1>Chat Room</h1>
            <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                style={{ marginBottom: '10px' }}
            >
                <option value="General">General</option>
                <option value="Sports">Sports</option>
                <option value="Tech">Tech</option>
            </select>
            <div
                style={{
                    height: '300px',
                    overflowY: 'auto',
                    border: '1px solid #ccc',
                    padding: '10px',
                    backgroundColor: '#f9f9f9',
                }}
            >
                {messages.map((msg, index) => (
                    <p key={index} style={{ margin: '5px 0' }}>
                        <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
                    </p>
                ))}
            </div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                style={{
                    width: '80%',
                    padding: '10px',
                    marginRight: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                }}
            />
            <button
                onClick={sendMessage}
                style={{
                    padding: '10px 15px',
                    backgroundColor: '#1e90ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                }}
            >
                Send
            </button>
        </div>
    );
};

export default Chat;

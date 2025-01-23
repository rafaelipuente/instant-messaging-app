import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000'); // Backend WebSocket URL

const Chat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('General');
    const messageEndRef = useRef(null);

    // Scroll to the latest message
    const scrollToBottom = () => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        // Join the room
        socket.emit('joinRoom', room);
        console.log(`Joining room: ${room}`);
    
        // Listen for messages
        const handleMessage = (data) => {
            console.log('Message received from server:', data);
            setMessages((prev) => [...prev, data]);
        };
        socket.on('message', handleMessage);
    
        // Cleanup on unmount or room change
        return () => {
            console.log(`Leaving room: ${room}`);
            socket.emit('leaveRoom', room); // Optional: Inform server you're leaving the room
            socket.off('message', handleMessage); // Remove the listener
        };
    }, [room]);
    
    useEffect(() => {
        scrollToBottom(); // Scroll to the latest message when messages update
    }, [messages]);

    const sendMessage = () => {
        if (message.trim() === '') return;
        console.log('Sending message:', message);
        socket.emit('message', {
            room,
            user: 'React User',
            message,
        });
        setMessage('');
    };
    

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', textAlign: 'center' }}>
            <h1>Chat Room</h1>
            <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                style={{ marginBottom: '10px', padding: '5px' }}
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
                    marginBottom: '10px',
                    padding: '10px',
                    background: '#f9f9f9',
                }}
            >
                {messages.map((msg, index) => (
                    <p key={index} style={{ margin: '5px 0' }}>
                        <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
                    </p>
                ))}
                <div ref={messageEndRef} />
            </div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                style={{ padding: '10px', width: '75%', marginRight: '5px' }}
            />
            <button onClick={sendMessage} style={{ padding: '10px' }}>
                Send
            </button>
        </div>
    );
};

export default Chat;

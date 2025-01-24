import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const socket = io('http://localhost:5000'); // Backend WebSocket URL

const Chat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('General');
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        if (!authUser || !authUser.token) {
            navigate('/login');
            return;
        }

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

        // Clean up listeners when component unmounts or room changes
        return () => {
            console.log('Leaving room:', room);
            socket.emit('leaveRoom', room);
            socket.off('loadMessages');
            socket.off('message');
        };
    }, [room, navigate]);

    const sendMessage = () => {
        if (message.trim() === '') return;
    
        // Retrieve the logged-in user's name from local storage or another source
        const user = authUser?.name || 'Anonymous';
    
        const newMessage = {
            room,
            user,
            message,
        };
    
        console.log('Sending message:', newMessage);
        socket.emit('message', newMessage); // Emit message to backend
        setMessage('');
    };

    // Assuming authUser is defined in the scope of this component
    const authUser = JSON.parse(localStorage.getItem('authUser'));

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
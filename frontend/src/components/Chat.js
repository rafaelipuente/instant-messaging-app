import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';

const socket = io('http://localhost:5000'); // Backend WebSocket URL

const Chat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('General');
    const navigate = useNavigate();

    useEffect(() => {
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

        return () => {
            console.log('Leaving room:', room);
            socket.emit('leaveRoom', room);
            socket.off('loadMessages');
            socket.off('message');
        };
    }, [room, navigate]);

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

    const authUser = JSON.parse(localStorage.getItem('authUser'));

    return (
        <div className="chat-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#2c2c2c', color: 'white', padding: '20px' }}>
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0 }}>Chat Room</h1>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}>Logout</button>
            </div>
            <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                style={{ marginBottom: '10px', padding: '5px', borderRadius: '5px' }}
            >
                <option value="General">General</option>
                <option value="Sports">Sports</option>
                <option value="Tech">Tech</option>
            </select>
            <div className="chat-messages" style={{
                height: '80vh',
                overflowY: 'auto',
                border: '1px solid #444',
                padding: '10px',
                backgroundColor: '#333',
                flexGrow: 1,
                marginBottom: '10px'
            }}>
                {messages.map((msg, index) => (
                    <p key={index} style={{ margin: '5px 0', color: msg.user === authUser?.name ? '#1e90ff' : 'white' }}>
                        <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
                    </p>
                ))}
            </div>
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
                        color: 'white'
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
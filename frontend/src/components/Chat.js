import React, { useEffect, useState, useRef } from 'react';
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        if (!authUser || !authUser.token) {
            navigate('/login');
            return;
        }

        socket.emit('joinRoom', room);

        socket.on('loadMessages', (loadedMessages) => {
            setMessages(loadedMessages);
        });

        socket.on('message', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        return () => {
            socket.emit('leaveRoom', room);
            socket.off('loadMessages');
            socket.off('message');
        };
    }, [room, navigate]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = () => {
        if (message.trim() === '') return;

        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const user = authUser?.name || 'Anonymous';

        const newMessage = {
            room,
            user,
            message,
        };

        socket.emit('message', newMessage);
        setMessage('');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const authUser = JSON.parse(localStorage.getItem('authUser'));

    return (
        <div className="flex flex-col h-screen bg-gray-800 text-white p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Chat Room</h1>
                <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600">
                    Logout
                </button>
            </div>
            <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="mb-4 p-2 bg-gray-700 rounded"
            >
                <option value="General">General</option>
                <option value="Sports">Sports</option>
                <option value="Tech">Tech</option>
            </select>
            <div className="flex-1 overflow-y-auto bg-gray-700 p-4 rounded mb-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`p-2 my-2 rounded ${msg.user === authUser?.name ? 'bg-blue-500 ml-auto' : 'bg-gray-600'}`}
                    >
                        <strong>{msg.user || 'Anonymous'}:</strong> {msg.message}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-2 bg-gray-700 rounded"
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                    onClick={sendMessage}
                    className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default Chat;
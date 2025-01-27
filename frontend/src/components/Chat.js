import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { isTokenValid } from '../utils/auth';

const socket = io('http://localhost:5000'); // Replace with your backend URL

const Chat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('General'); // Default room

    useEffect(() => {
        if (!isTokenValid()) {
            window.location.href = '/login'; // Redirect to login if token is invalid
            return;
        }

        // Join the default room
        socket.emit('joinRoom', room);

        // Load initial messages for the room
        socket.on('loadMessages', (loadedMessages) => {
            setMessages(loadedMessages);
        });

        // Listen for new messages
        socket.on('message', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        // Cleanup on unmount
        return () => {
            socket.emit('leaveRoom', room); // Leave the room
            socket.off('loadMessages');
            socket.off('message');
        };
    }, [room]); // Re-run whenever the room changes

    const sendMessage = () => {
        if (message.trim() === '') return;
    
        const authUser = JSON.parse(localStorage.getItem('authUser')); // Retrieve user from localStorage
        if (!authUser || !authUser.name) {
            console.error('User not logged in or missing name');
            return;
        }
    
        const newMessage = {
            room,
            user: authUser.name, // Include the user's name
            message,
            timestamp: new Date().toISOString(),
        };
    
        socket.emit('message', newMessage); // Send message to the server
        setMessage(''); // Clear input field
    };
    

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-gray-800 shadow-md">
                <h1 className="text-xl font-bold">Chat Room: {room}</h1>
                <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="p-2 bg-gray-700 rounded"
                >
                    <option value="General">General</option>
                    <option value="Sports">Sports</option>
                    <option value="Tech">Tech</option>
                </select>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-800">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${
                            msg.user === JSON.parse(localStorage.getItem('authUser'))?.name
                                ? 'justify-end'
                                : 'justify-start'
                        }`}
                    >
                        <div
                            className={`p-3 rounded-lg shadow-md max-w-xs ${
                                msg.user === JSON.parse(localStorage.getItem('authUser'))?.name
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-700 text-gray-200'
                            }`}
                        >
                            <div className="text-sm font-semibold">{msg.user || 'Anonymous'}</div>
                            <div className="text-md">{msg.message}</div>
                            <div className="text-xs text-gray-300 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-800 shadow-md">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 p-2 rounded bg-gray-700 text-white focus:outline-none"
                    />
                    <button
                        onClick={sendMessage}
                        className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 text-white"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;

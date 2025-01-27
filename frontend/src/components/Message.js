import React, { useEffect, useRef } from 'react';

/**
 * Messages Component
 * @param {Array} messages - Array of messages to display.
 * @param {String} currentUser - Name of the current user to style their messages.
 */
const Messages = ({ messages, currentUser }) => {
    const messagesEndRef = useRef(null);

    // Automatically scroll to the bottom when a new message is added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-700 rounded">
            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={`p-2 mb-2 rounded ${
                        msg.user === currentUser ? 'bg-blue-500 ml-auto' : 'bg-gray-600'
                    }`}
                    style={{
                        maxWidth: '70%',
                        alignSelf: msg.user === currentUser ? 'flex-end' : 'flex-start',
                    }}
                >
                    <div className="text-sm font-semibold">{msg.user || 'Anonymous'}</div>
                    <div className="text-md">{msg.message}</div>
                    <div className="text-xs text-gray-300 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                </div>
            ))}
            {/* Dummy div for auto-scroll */}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default Messages;

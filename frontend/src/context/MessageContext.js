import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { toast } from 'react-toastify';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Simple message handling following the friend's pattern
  const deleteMessage = (messageId) => {
    if (!socket || !messageId) return;
    
    // Optimistic UI update - mark message as "deleting"
    setMessages(prev => prev.map(msg => 
      msg._id === messageId ? { ...msg, isDeleting: true } : msg
    ));
    
    // Send delete request to server
    socket.emit('deleteMessage', { messageId });
  };

  // Listen for message delete confirmations
  useEffect(() => {
    if (!socket) return;
    
    socket.on('messageDeleted', (messageId) => {
      console.log('Message deleted confirmation received:', messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    });
    
    socket.on('messageDeleteError', (error) => {
      console.error('Error deleting message:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
      
      // Revert the "deleting" state if there was an error
      setMessages(prev => prev.map(msg => 
        msg.isDeleting ? { ...msg, isDeleting: false } : msg
      ));
    });
    
    return () => {
      socket.off('messageDeleted');
      socket.off('messageDeleteError');
    };
  }, [socket]);

  const value = {
    messages,
    setMessages,
    loading,
    error,
    deleteMessage
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => useContext(MessageContext);

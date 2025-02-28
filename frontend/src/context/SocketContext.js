import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../config';

// Create the context
const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.token) {
      // Clean up any existing socket
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create new socket connection
    const newSocket = io(SOCKET_URL, {
      auth: { token: user.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      setConnected(true);
      setError(null);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
      setError(err.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    // Set the socket state
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.token]);

  // Method to emit events with error handling
  const emitEvent = (eventName, data, callback) => {
    if (!socket || !connected) {
      console.error(`Cannot emit ${eventName}: Socket not connected`);
      return false;
    }

    try {
      if (callback) {
        socket.emit(eventName, data, callback);
      } else {
        socket.emit(eventName, data);
      }
      return true;
    } catch (err) {
      console.error(`Error emitting ${eventName}:`, err);
      return false;
    }
  };

  // Register an event listener
  const onEvent = (eventName, callback) => {
    if (!socket) return () => {};
    
    socket.on(eventName, callback);
    return () => socket.off(eventName, callback);
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      connected, 
      error,
      emitEvent,
      onEvent
    }}>
      {children}
    </SocketContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  // Track custom event listeners
  const eventListeners = useRef(new Map());

  // Define emitEvent function here before using it in useEffect
  const emitEventFn = (eventName, data, callback) => {
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

  // Handle global socket:emit events from the app
  useEffect(() => {
    const handleSocketEmit = (event) => {
      const { detail } = event;
      if (detail && detail.event && detail.data) {
        console.log(`[SocketContext] Emitting event: ${detail.event}`, detail.data);
        emitEventFn(detail.event, detail.data);
      }
    };

    window.addEventListener('socket:emit', handleSocketEmit);
    return () => window.removeEventListener('socket:emit', handleSocketEmit);
  }, [socket, connected]); // Re-add when socket or connection status changes

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
    
    // Register custom listeners
    if (eventListeners.current.size > 0) {
      console.log('Re-registering event listeners after reconnection');
      eventListeners.current.forEach((callback, eventName) => {
        newSocket.on(eventName, callback);
      });
    }

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
  const emitEvent = emitEventFn;

  // Register an event listener
  const onEvent = (eventName, callback) => {
    if (!socket) return () => {};
    
    // Store the callback to re-register on reconnection
    eventListeners.current.set(eventName, callback);
    
    socket.on(eventName, callback);
    return () => {
      socket.off(eventName, callback);
      eventListeners.current.delete(eventName);
    };
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

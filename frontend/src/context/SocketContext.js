import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../config';
import toast from 'react-hot-toast';

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

  const eventListeners = useRef(new Map());

  const emitEventFn = (eventName, data, callback) => {
    if (!socket || !connected) {
      console.error(`Cannot emit ${eventName}: Socket not connected`);
      toast.error('Cannot send message: Not connected to server');
      return false;
    }

    try {
      if (callback) {
        socket.emit(eventName, data, callback);
      } else {
        socket.emit(eventName, data);
      }
      console.log(`[SocketContext] Emitted ${eventName}:`, data);
      return true;
    } catch (err) {
      console.error(`Error emitting ${eventName}:`, err);
      toast.error(`Failed to emit ${eventName}: ${err.message}`);
      return false;
    }
  };

  useEffect(() => {
    const handleSocketEmit = (event) => {
      const { detail } = event;
      if (detail && detail.event && detail.data) {
        console.log(`[SocketContext] Handling socket:emit for ${detail.event}`, detail.data);
        emitEventFn(detail.event, detail.data);
      } else {
        console.error('[SocketContext] Invalid socket:emit event:', event);
      }
    };

    window.addEventListener('socket:emit', handleSocketEmit);
    return () => window.removeEventListener('socket:emit', handleSocketEmit);
  }, [socket, connected]);

  useEffect(() => {
    if (!user?.token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setError(null);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token: user.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('[SocketContext] Socket connected successfully');
      setConnected(true);
      setError(null);
      toast.success('Connected to server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('[SocketContext] Socket connection error:', err);
      setConnected(false);
      setError(err.message);
      toast.error(`Connection failed: ${err.message}`);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketContext] Reconnection attempt ${attempt}`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('[SocketContext] Reconnection failed after all attempts');
      setConnected(false);
      setError('Failed to reconnect to server');
      toast.error('Failed to reconnect to server');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[SocketContext] Socket disconnected:', reason);
      setConnected(false);
      setError(`Disconnected: ${reason}`);
      toast.error(`Disconnected from server: ${reason}`);
    });

    if (eventListeners.current.size > 0) {
      console.log('[SocketContext] Re-registering event listeners after reconnection');
      eventListeners.current.forEach((callback, eventName) => {
        newSocket.on(eventName, callback);
      });
    }

    setSocket(newSocket);

    return () => {
      console.log('[SocketContext] Cleaning up socket connection');
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
      setError(null);
    };
  }, [user?.token]);

  const emitEvent = emitEventFn;

  const onEvent = (eventName, callback) => {
    if (!socket) {
      console.warn(`[SocketContext] Cannot register listener for ${eventName}: Socket not initialized`);
      return () => {};
    }

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
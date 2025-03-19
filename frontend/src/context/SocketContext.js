import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../config';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        console.log('No user, disconnecting socket');
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection
    console.log('Creating socket connection to', SOCKET_URL);
    const newSocket = io(SOCKET_URL, {
      auth: { token: user.token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected!');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected!');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        console.log('Cleaning up socket connection');
        newSocket.disconnect();
        setSocket(null);
        setConnected(false);
      }
    };
  }, [user]);

  const value = {
    socket,
    connected,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);

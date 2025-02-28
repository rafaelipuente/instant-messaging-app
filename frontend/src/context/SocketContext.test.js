import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SocketProvider, useSocket } from './SocketContext';

// Mock socket.io-client
const mockSocketOn = jest.fn();
const mockSocketEmit = jest.fn();
const mockSocketDisconnect = jest.fn();
const mockSocketOff = jest.fn();

const mockSocket = {
  on: mockSocketOn,
  emit: mockSocketEmit,
  disconnect: mockSocketDisconnect,
  off: mockSocketOff
};

jest.mock('socket.io-client', () => {
  return jest.fn(() => mockSocket);
});

// Mock the config.js
jest.mock('../config', () => ({
  SOCKET_URL: 'http://localhost:5001',
  API_BASE_URL: 'http://localhost:5001/api'
}));

// Mock the auth context
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: {
      _id: 'user123',
      username: 'testuser',
      token: 'fake-token-123'
    }
  })
}));

// Test component that uses the SocketContext
const TestComponent = () => {
  const { connected, error, emitEvent } = useSocket();

  return (
    <div>
      <div data-testid="connection-state">{connected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="error-state">{error || 'No Error'}</div>
      <button 
        data-testid="emit-button"
        onClick={() => emitEvent('testEvent', { message: 'Hello World' })}
      >
        Emit Event
      </button>
    </div>
  );
};

describe('SocketContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes socket connection when user is available', () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // Initial state should be disconnected, then connects once socket is created
    expect(screen.getByTestId('connection-state')).toHaveTextContent('Disconnected');
    
    // Verify that socket.io-client was called
    const io = require('socket.io-client');
    expect(io).toHaveBeenCalledWith(
      'http://localhost:5001',
      expect.objectContaining({
        auth: { token: 'fake-token-123' },
        transports: ['websocket']
      })
    );
  });

  test('emitEvent function calls socket.emit', () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // Trigger a connect event
    const connectHandler = mockSocketOn.mock.calls.find(call => call[0] === 'connect');
    if (connectHandler && connectHandler[1]) {
      connectHandler[1]();
    }

    // Now we should be connected
    expect(screen.getByTestId('connection-state')).toHaveTextContent('Connected');

    // Test emit functionality
    screen.getByTestId('emit-button').click();
    
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'testEvent',
      { message: 'Hello World' }
    );
  });

  test('handles socket errors', () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // Trigger a connect_error event
    const errorHandler = mockSocketOn.mock.calls.find(call => call[0] === 'connect_error');
    if (errorHandler && errorHandler[1]) {
      errorHandler[1]({ message: 'Connection failed' });
    }

    // Error should be displayed
    expect(screen.getByTestId('error-state')).toHaveTextContent('Connection failed');
  });

  test('cleans up socket on unmount', () => {
    const { unmount } = render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    unmount();

    // Should call disconnect when unmounted
    expect(mockSocketDisconnect).toHaveBeenCalled();
  });
});

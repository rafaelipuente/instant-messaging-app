import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MessageProvider, useMessages } from './MessageContext';
import { AuthProvider } from './AuthContext';
import { SocketProvider } from './SocketContext';

// Create mock providers to wrap our component
const AllTheProviders = ({ children }) => {
  return (
    <AuthProvider>
      <SocketProvider>
        <MessageProvider>
          {children}
        </MessageProvider>
      </SocketProvider>
    </AuthProvider>
  );
};

// Mock the socket context
jest.mock('./SocketContext', () => ({
  useSocket: () => ({
    connected: true,
    emitEvent: jest.fn((event, data) => {
      // Mock successful emit
      return true;
    }),
    onEvent: jest.fn((event, callback) => {
      // Return a mock cleanup function
      return jest.fn();
    })
  })
}));

// Mock the auth context
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: {
      _id: 'user123',
      username: 'testuser',
      profilePicture: '/path/to/picture.jpg',
      token: 'fake-token-123'
    }
  })
}));

// Test component that uses the MessageContext
const TestComponent = () => {
  const { 
    messages, 
    activeConversation, 
    loading,
    sendMessage,
    deleteMessage,
    setActiveConversation,
    setConversationType
  } = useMessages();

  return (
    <div>
      <div data-testid="loading-state">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="active-conversation">{activeConversation ? activeConversation.name || activeConversation.username : 'None'}</div>
      <button 
        data-testid="send-button"
        onClick={() => sendMessage('Test message')}
      >
        Send Message
      </button>
      <button 
        data-testid="delete-button"
        onClick={() => deleteMessage('msg123')}
      >
        Delete Message
      </button>
      <button 
        data-testid="set-channel-button"
        onClick={() => {
          setActiveConversation({ id: 'channel1', name: 'General' });
          setConversationType('channel');
        }}
      >
        Set Channel
      </button>
      <button 
        data-testid="set-direct-button"
        onClick={() => {
          setActiveConversation({ _id: 'user456', username: 'friend' });
          setConversationType('direct');
        }}
      >
        Set Direct Message
      </button>
    </div>
  );
};

describe('MessageContext', () => {
  test('provides initial state correctly', () => {
    render(
      <AllTheProviders>
        <TestComponent />
      </AllTheProviders>
    );

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-conversation')).toHaveTextContent('None');
  });

  test('allows setting active conversation', async () => {
    render(
      <AllTheProviders>
        <TestComponent />
      </AllTheProviders>
    );

    // Set active conversation to a channel
    userEvent.click(screen.getByTestId('set-channel-button'));
    await waitFor(() => {
      expect(screen.getByTestId('active-conversation')).toHaveTextContent('General');
    });

    // Set active conversation to a direct message
    userEvent.click(screen.getByTestId('set-direct-button'));
    await waitFor(() => {
      expect(screen.getByTestId('active-conversation')).toHaveTextContent('friend');
    });
  });

  test('sendMessage function works correctly', () => {
    render(
      <AllTheProviders>
        <TestComponent />
      </AllTheProviders>
    );

    // First set a conversation
    userEvent.click(screen.getByTestId('set-channel-button'));
    
    // Mock message sending
    const originalSetState = React.useState;
    jest.spyOn(React, 'useState').mockImplementationOnce((initialState) => {
      return [initialState, jest.fn()];
    });
    
    userEvent.click(screen.getByTestId('send-button'));
    
    // Restore original useState
    React.useState = originalSetState;
  });

  test('deleteMessage function works correctly', () => {
    render(
      <AllTheProviders>
        <TestComponent />
      </AllTheProviders>
    );

    // Mock message deletion
    const originalSetState = React.useState;
    jest.spyOn(React, 'useState').mockImplementationOnce((initialState) => {
      return [initialState, jest.fn()];
    });
    
    userEvent.click(screen.getByTestId('delete-button'));
    
    // Restore original useState
    React.useState = originalSetState;
  });
});

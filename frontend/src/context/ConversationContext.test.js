import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConversationProvider, useConversation } from './ConversationContext';

// Mock fetch API
global.fetch = jest.fn();

// Mock the config.js
jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5001/api'
}));

// Mock AuthContext
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user123', username: 'testuser' },
    token: 'fake-token-123'
  })
}));

// Test component that uses the ConversationContext
const TestComponent = () => {
  const { 
    conversations, 
    users,
    selectedConversation,
    loading,
    error,
    setSelectedConversation
  } = useConversation();

  return (
    <div>
      <div data-testid="conversations-count">
        {conversations ? conversations.length : 0} conversations
      </div>
      <div data-testid="users-count">
        {users ? users.length : 0} users
      </div>
      <div data-testid="selected-conversation">
        {selectedConversation ? selectedConversation.name : 'None'}
      </div>
      <div data-testid="loading-state">
        {loading ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="error-state">
        {error || 'No Error'}
      </div>
      <button
        data-testid="select-conversation-button"
        onClick={() => {
          if (conversations && conversations.length > 0) {
            setSelectedConversation(conversations[0]);
          }
        }}
      >
        Select First Conversation
      </button>
    </div>
  );
};

describe('ConversationContext', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  test('initializes with empty conversations and users', () => {
    // Mock fetch to return empty arrays before component renders
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );

    render(
      <ConversationProvider>
        <TestComponent />
      </ConversationProvider>
    );

    // Initial state should be empty
    expect(screen.getByTestId('conversations-count')).toHaveTextContent('0 conversations');
    expect(screen.getByTestId('users-count')).toHaveTextContent('0 users');
    expect(screen.getByTestId('selected-conversation')).toHaveTextContent('None');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading');
  });

  test('fetches conversations and users successfully', async () => {
    // Mock successful API responses
    const mockConversations = [
      { _id: 'conv1', name: 'General', participants: ['user123', 'user456'] }
    ];
    const mockUsers = [
      { _id: 'user123', username: 'testuser' },
      { _id: 'user456', username: 'otheruser' }
    ];

    // First fetch call for conversations
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockConversations)
      })
    );

    // Second fetch call for users
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })
    );

    render(
      <ConversationProvider>
        <TestComponent />
      </ConversationProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
    });

    // Verify that the data was loaded
    expect(screen.getByTestId('conversations-count')).toHaveTextContent('1 conversations');
    expect(screen.getByTestId('users-count')).toHaveTextContent('2 users');
  });

  test('handles API errors gracefully', async () => {
    // Mock failed API responses
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' })
      })
    );

    render(
      <ConversationProvider>
        <TestComponent />
      </ConversationProvider>
    );

    // Wait for error to be set
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toHaveTextContent(/error/i);
    });

    // Verify loading state is reset
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
  });

  test('selects a conversation correctly', async () => {
    // Mock successful API responses
    const mockConversations = [
      { _id: 'conv1', name: 'General', participants: ['user123', 'user456'] }
    ];
    const mockUsers = [
      { _id: 'user123', username: 'testuser' },
      { _id: 'user456', username: 'otheruser' }
    ];

    // First fetch call for conversations
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockConversations)
      })
    );

    // Second fetch call for users
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })
    );

    render(
      <ConversationProvider>
        <TestComponent />
      </ConversationProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
    });

    // Click the select conversation button
    act(() => {
      screen.getByTestId('select-conversation-button').click();
    });

    // Verify that the conversation was selected
    expect(screen.getByTestId('selected-conversation')).toHaveTextContent('General');
  });
});

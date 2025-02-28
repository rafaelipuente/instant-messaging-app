import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MessagingHub from './MessagingHub';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

// Mock context hooks
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      _id: 'user123',
      username: 'testuser',
      profilePicture: '/path/to/picture.jpg'
    }
  })
}));

jest.mock('../context/MessageContext', () => ({
  useMessages: () => ({
    messages: [
      {
        _id: 'msg1',
        content: 'Hello world',
        sender: {
          _id: 'user123',
          username: 'testuser',
          profilePicture: '/path/to/picture.jpg'
        },
        createdAt: '2023-01-01T12:00:00.000Z',
        conversationId: 'conv1'
      },
      {
        _id: 'msg2',
        content: 'How are you?',
        sender: {
          _id: 'user456',
          username: 'otheruser',
          profilePicture: '/path/to/other.jpg'
        },
        createdAt: '2023-01-01T12:01:00.000Z',
        conversationId: 'conv1'
      }
    ],
    loading: false,
    activeConversation: {
      _id: 'conv1',
      name: 'General',
      type: 'channel'
    },
    conversationType: 'channel',
    typing: [],
    unreadMessages: {},
    loadMessages: jest.fn(),
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
    markAsRead: jest.fn(),
    setActiveConversation: jest.fn(),
    setConversationType: jest.fn()
  })
}));

jest.mock('../context/ConversationContext', () => ({
  useConversations: () => ({
    channels: [
      { _id: 'conv1', name: 'General', type: 'channel' },
      { _id: 'conv2', name: 'Random', type: 'channel' }
    ],
    directConversations: [
      { 
        _id: 'user456', 
        username: 'otheruser', 
        profilePicture: '/path/to/other.jpg',
        type: 'direct'
      }
    ],
    users: [
      { _id: 'user456', username: 'otheruser', profilePicture: '/path/to/other.jpg' },
      { _id: 'user789', username: 'thirduser', profilePicture: '/path/to/third.jpg' }
    ],
    loading: false,
    createChannel: jest.fn(),
    startDirectConversation: jest.fn(),
    createConversation: jest.fn()
  })
}));

jest.mock('../context/SocketContext', () => ({
  useSocket: () => ({
    connected: true,
    error: null,
    emitEvent: jest.fn(),
    onEvent: jest.fn(() => jest.fn()) // Return cleanup function
  })
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: jest.fn()
  })
}));

// Mock the Navbar component
jest.mock('./Navbar', () => {
  return function DummyNavbar() {
    return <div data-testid="navbar">Navbar</div>;
  };
});

// Mock the UserAvatar component
jest.mock('./UserAvatar', () => {
  return function DummyUserAvatar({ username, size }) {
    return <div data-testid="user-avatar">{username}</div>;
  };
});

describe('MessagingHub', () => {
  test('renders the navbar', () => {
    render(<MessagingHub />);
    const navbar = screen.getByTestId('navbar');
    expect(navbar).toBeInTheDocument();
  });

  test('renders channels list', () => {
    render(<MessagingHub />);
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
  });

  test('renders direct messages list', () => {
    render(<MessagingHub />);
    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
    expect(screen.getByText('otheruser')).toBeInTheDocument();
  });

  test('renders messages from active conversation', () => {
    render(<MessagingHub />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('How are you?')).toBeInTheDocument();
  });

  test('has a message input field', () => {
    render(<MessagingHub />);
    const input = screen.getByPlaceholderText('Type a message...');
    expect(input).toBeInTheDocument();
  });
});

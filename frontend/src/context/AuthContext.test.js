import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from './AuthContext';

// Mock fetch API
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock the config.js
jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5001/api'
}));

const mockFetchSuccess = () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ 
      user: { _id: 'user123', username: 'testuser' },
      token: 'fake-token-123'
    })
  });
};

const mockFetchError = (errorMessage) => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: async () => ({ 
      message: errorMessage 
    })
  });
};

// Test component that uses the AuthContext
const TestComponent = () => {
  const { user, loading, error, login, register, logout } = useAuth();

  const handleLogin = () => {
    login('testuser', 'password123');
  };

  const handleRegister = () => {
    register('testuser', 'password123', 'test@example.com');
  };

  return (
    <div>
      <div data-testid="user-state">{user ? `Logged in as ${user.username}` : 'Not logged in'}</div>
      <div data-testid="loading-state">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error-state">{error || 'No Error'}</div>
      <button data-testid="register-button" onClick={handleRegister}>Register</button>
      <button data-testid="login-button" onClick={handleLogin}>Login</button>
      <button data-testid="logout-button" onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    global.fetch.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  test('initializes with no user', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state should be not logged in
    expect(screen.getByTestId('user-state')).toHaveTextContent('Not logged in');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
    expect(screen.getByTestId('error-state')).toHaveTextContent('No Error');
  });

  test('initializes with stored user', async () => {
    const mockUser = { _id: 'user123', username: 'testuser' };
    const mockToken = 'fake-token-123';
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return mockToken;
      return null;
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should initialize with the user from localStorage
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('Logged in as testuser');
    });
  });

  test('logs in user successfully', async () => {
    // Mock a successful login response
    mockFetchSuccess();
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state should be not logged in
    expect(screen.getByTestId('user-state')).toHaveTextContent('Not logged in');

    // Click login button
    fireEvent.click(screen.getByTestId('login-button'));

    // After login, user should be logged in
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('Logged in as testuser');
    });

    // Verify the fetch call
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5001/api/users/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      })
    );

    // Verify localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify({ _id: 'user123', username: 'testuser' }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'fake-token-123');
  });

  test('handles login errors correctly', async () => {
    // Mock a failed login response
    mockFetchError('Invalid credentials');
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Click login button
    fireEvent.click(screen.getByTestId('login-button'));

    // Wait for the error to be set in state
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('user-state')).toHaveTextContent('Not logged in');
    });
  });

  test('logs out user', async () => {
    // Set up initial logged in state
    const mockUser = { _id: 'user123', username: 'testuser' };
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return 'fake-token-123';
      return null;
    });
    
    const { rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for user to be logged in
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('Logged in as testuser');
    });

    // Reset the mocks for the removal calls
    localStorageMock.removeItem.mockClear();

    // Click logout button
    fireEvent.click(screen.getByTestId('logout-button'));

    // After logout, user should be not logged in
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('Not logged in');
    });
    
    // Verify localStorage items were removed
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
  });
});

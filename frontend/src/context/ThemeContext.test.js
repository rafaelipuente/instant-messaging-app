import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from './ThemeContext';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component that uses the ThemeContext
const TestComponent = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div data-testid="theme-container" className={`app ${theme}`}>
      <div data-testid="current-theme">{theme}</div>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  test('initializes with light theme by default', () => {
    // Mock localStorage to return null for theme
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // By default, it should be light theme
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('theme-container')).toHaveClass('app light');
  });

  test('initializes with stored theme if available', () => {
    // Mock localStorage to return dark theme
    localStorageMock.getItem.mockReturnValue(JSON.stringify('dark'));
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Should use the theme from localStorage
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('theme-container')).toHaveClass('app dark');
  });

  test('toggles theme correctly', () => {
    // Start with light theme
    localStorageMock.getItem.mockReturnValue(JSON.stringify('light'));
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initial state should be light
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

    // Click the toggle button
    fireEvent.click(screen.getByTestId('toggle-button'));

    // Theme should change to dark
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('theme-container')).toHaveClass('app dark');
    
    // localStorage should be updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', JSON.stringify('dark'));
  });

  test('handles toggling from dark to light', () => {
    // Start with dark theme
    localStorageMock.getItem.mockReturnValue(JSON.stringify('dark'));
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initial state should be dark
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');

    // Click the toggle button
    fireEvent.click(screen.getByTestId('toggle-button'));

    // Theme should change to light
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('theme-container')).toHaveClass('app light');
    
    // localStorage should be updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', JSON.stringify('light'));
  });
});

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock implementations
jest.mock('socket.io-client', () => {
  const mockOn = jest.fn();
  const mockEmit = jest.fn();
  const mockOff = jest.fn();
  const mockDisconnect = jest.fn();

  return {
    __esModule: true,
    default: jest.fn(() => ({
      on: mockOn,
      emit: mockEmit,
      off: mockOff,
      disconnect: mockDisconnect,
      io: {
        on: mockOn,
        emit: mockEmit,
        off: mockOff
      }
    }))
  };
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Suppress console errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalConsoleError(...args);
  };
  console.warn = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

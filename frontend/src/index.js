import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/App';
import { AuthProvider } from './context/AuthContext';
import { MessageProvider } from './context/MessageContext';
import { SocketProvider } from './context/SocketContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <MessageProvider>
          <App />
        </MessageProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);

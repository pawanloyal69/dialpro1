import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react';
import { useAuth } from './AuthContext';
import { getAccessToken } from './client'; // ✅ MUST be top-level

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!user) return;

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    const token = getAccessToken();
    if (!token) return;

    const ws = new WebSocket(
      `${BACKEND_URL}/ws/${user.id}?token=${token}`
    );

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [user]);

  const sendMessage = useCallback(
    (message) => {
      if (socket && connected) {
        socket.send(JSON.stringify(message));
      }
    },
    [socket, connected]
  );

  return (
    <WebSocketContext.Provider
      value={{ socket, connected, messages, sendMessage }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

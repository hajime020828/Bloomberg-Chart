// app/hooks/useWebSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  disconnect: () => void;
  reconnect: () => void;
  lastMessage: any;
  connectionAttempts: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    try {
      // 既存の接続があれば閉じる
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }

      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionAttempts(0);
        clearReconnectTimeout();
        onOpen?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onClose?.();

        // 自動再接続
        if (connectionAttempts < maxReconnectAttempts) {
          reconnectTimeout.current = setTimeout(() => {
            setConnectionAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      
      // 接続失敗時の再接続
      if (connectionAttempts < maxReconnectAttempts) {
        reconnectTimeout.current = setTimeout(() => {
          setConnectionAttempts(prev => prev + 1);
          connect();
        }, reconnectInterval);
      }
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts, connectionAttempts, clearReconnectTimeout]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    setConnectionAttempts(maxReconnectAttempts); // 再接続を防ぐ
    ws.current?.close();
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  const reconnect = useCallback(() => {
    setConnectionAttempts(0);
    disconnect();
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();

    return () => {
      clearReconnectTimeout();
      ws.current?.close();
    };
  }, [connect, clearReconnectTimeout]);

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect,
    lastMessage,
    connectionAttempts,
  };
}